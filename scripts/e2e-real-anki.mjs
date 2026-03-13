import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cwd = process.cwd();
const stateDir = resolve(cwd, '.data');
const statePath = resolve(stateDir, 'real-anki-e2e-state.json');
const scenario = process.env.ANKI_E2E_SCENARIO ?? 'start';
const profileId = process.env.ANKI_E2E_PROFILE_ID;
const finalize = process.env.ANKI_E2E_FINALIZE ?? 'delete';
const mode = process.env.ANKI_E2E_MODE ?? 'single';

if (!profileId) {
  console.error('ANKI_E2E_PROFILE_ID is required');
  process.exit(1);
}

mkdirSync(stateDir, { recursive: true });

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/src/index.js'],
  cwd,
});
const client = new Client({ name: 'real-anki-e2e', version: '0.1.0' });

function parseToolResult(result) {
  const textChunk = result?.content?.find((item) => item.type === 'text');
  return textChunk?.text ? JSON.parse(textChunk.text) : null;
}

async function callTool(name, args) {
  return parseToolResult(await client.callTool({ name, arguments: args }));
}

async function ensureNoteTypeAndDeck(deckName) {
  await callTool('ensure_deck', {
    profileId,
    deckName,
  });

  await callTool('upsert_note_type', {
    profileId,
    modelName: 'e2e.v1.review-note',
    dryRun: false,
    fields: [{ name: 'Prompt' }, { name: 'Answer' }, { name: 'Extra' }],
    templates: [{
      name: 'Card 1',
      front: '<div class="e2e">{{Prompt}}</div>',
      back: '{{FrontSide}}<hr id="answer"><div>{{Answer}}</div>{{#Extra}}<div class="extra">{{Extra}}</div>{{/Extra}}',
    }],
    css: '.card { background: #11161d; color: #edf3fb; font-family: "Avenir Next", "Noto Sans JP", sans-serif; padding: 20px; } .e2e { font-size: 20px; line-height: 1.6; } .extra { margin-top: 12px; color: #9fb3c8; font-size: 15px; }',
  });
}

async function runSingleStart() {
  const deckName = 'Testing::E2E::Single';
  await ensureNoteTypeAndDeck(deckName);

  const added = await callTool('add_note', {
    profileId,
    clientRequestId: `real-e2e-single-${Date.now()}`,
    deckName,
    modelName: 'e2e.v1.review-note',
    fields: {
      Prompt: 'E2E test prompt',
      Answer: 'E2E test answer',
      Extra: 'Initial review note',
    },
    tags: ['e2e', 'review-pending'],
  });

  const preview = await callTool('open_note_preview', {
    profileId,
    noteId: added.note.noteId,
  });

  writeFileSync(statePath, JSON.stringify({
    profileId,
    mode,
    note: added.note,
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    scenario: 'start',
    mode,
    statePath,
    noteId: added.note.noteId,
    preview: preview.preview,
    nextStep: 'Inspect the preview in Anki, then rerun with ANKI_E2E_SCENARIO=finalize and ANKI_E2E_FINALIZE=update|unsuspend|delete.',
  }, null, 2));
}

async function runBatchStart() {
  const deckName = 'Testing::E2E::Batch';
  await ensureNoteTypeAndDeck(deckName);

  const added = await callTool('add_notes_batch', {
    profileId,
    items: [
      {
        itemId: 'batch-1',
        clientRequestId: `real-e2e-batch-1-${Date.now()}`,
        deckName,
        modelName: 'e2e.v1.review-note',
        fields: {
          Prompt: 'E2E batch prompt 1',
          Answer: 'E2E batch answer 1',
          Extra: 'batch-1',
        },
      },
      {
        itemId: 'batch-2',
        clientRequestId: `real-e2e-batch-2-${Date.now()}`,
        deckName,
        modelName: 'e2e.v1.review-note',
        fields: {
          Prompt: 'E2E batch prompt 2',
          Answer: 'E2E batch answer 2',
          Extra: 'batch-2',
        },
      },
    ],
  });

  const firstSuccess = added.results.find((item) => item.ok);
  const preview = firstSuccess
    ? await callTool('open_note_preview', { profileId, noteId: firstSuccess.note.noteId })
    : null;

  writeFileSync(statePath, JSON.stringify({
    profileId,
    mode,
    notes: added.results.filter((item) => item.ok).map((item) => item.note),
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    scenario: 'start',
    mode,
    statePath,
    summary: added.summary,
    preview: preview?.preview ?? null,
    nextStep: 'Inspect the preview in Anki, then rerun with ANKI_E2E_SCENARIO=finalize and ANKI_E2E_FINALIZE=unsuspend|delete.',
  }, null, 2));
}

async function runFinalize() {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  let result;

  if (state.mode === 'batch') {
    if (finalize === 'unsuspend') {
      result = await Promise.all(
        state.notes.map((note) => callTool('set_note_cards_suspended', {
          profileId: state.profileId,
          noteId: note.noteId,
          suspended: false,
        })),
      );
    } else {
      result = await callTool('delete_notes_batch', {
        profileId: state.profileId,
        items: state.notes.map((note) => ({
          itemId: `delete-${note.noteId}`,
          noteId: note.noteId,
        })),
      });
    }
  } else if (finalize === 'update') {
    result = await callTool('update_note', {
      profileId: state.profileId,
      noteId: state.note.noteId,
      expectedModTimestamp: state.note.modTimestamp,
      fields: {
        Extra: 'Updated during real-Anki E2E finalize',
      },
      tags: ['e2e', 'reviewed'],
    });

    const immediate = await callTool('get_notes', {
      profileId: state.profileId,
      noteIds: [state.note.noteId],
    });
    const searched = await callTool('search_notes', {
      profileId: state.profileId,
      deckNames: [state.note.deckName],
      tags: ['reviewed'],
      limit: 10,
    });

    result = {
      update: result,
      immediate,
      searched,
    };
  } else if (finalize === 'unsuspend') {
    result = await callTool('set_note_cards_suspended', {
      profileId: state.profileId,
      noteId: state.note.noteId,
      suspended: false,
    });
  } else {
    result = await callTool('delete_note', {
      profileId: state.profileId,
      noteId: state.note.noteId,
    });
  }

  rmSync(statePath, { force: true });
  console.log(JSON.stringify({
    ok: true,
    scenario: 'finalize',
    mode: state.mode ?? 'single',
    finalize,
    result,
  }, null, 2));
}

try {
  await client.connect(transport);
  if (scenario === 'start') {
    if (mode === 'batch') {
      await runBatchStart();
    } else {
      await runSingleStart();
    }
  } else if (scenario === 'finalize') {
    await runFinalize();
  } else {
    throw new Error(`Unknown ANKI_E2E_SCENARIO: ${scenario}`);
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await client.close();
}
