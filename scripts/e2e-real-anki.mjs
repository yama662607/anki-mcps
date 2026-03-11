import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const cwd = process.cwd();
const stateDir = resolve(cwd, '.data');
const statePath = resolve(stateDir, 'real-anki-e2e-state.json');
const scenario = process.env.ANKI_E2E_SCENARIO ?? 'start';
const profileId = process.env.ANKI_E2E_PROFILE_ID;
const finalize = process.env.ANKI_E2E_FINALIZE ?? 'discard';
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

async function runStart() {
  await callTool('upsert_note_type', {
    profileId,
    modelName: 'e2e.v1.basic',
    dryRun: false,
    fields: [{ name: 'Prompt' }, { name: 'Answer' }],
    templates: [{
      name: 'Card 1',
      front: '<div class="e2e">{{Prompt}}</div>',
      back: '{{FrontSide}}<hr id="answer"><div>{{Answer}}</div>',
    }],
    css: '.card { background: #10151d; color: #edf3fb; font-family: "Avenir Next", "Noto Sans JP", sans-serif; padding: 16px; } .e2e { font-size: 18px; line-height: 1.6; }',
  });

  await callTool('upsert_card_type_definition', {
    profileId,
    definition: {
      cardTypeId: 'e2e.v1.basic',
      label: 'E2E Basic',
      modelName: 'e2e.v1.basic',
      defaultDeck: 'Testing::E2E',
      requiredFields: ['Prompt', 'Answer'],
      optionalFields: [],
      renderIntent: 'production',
      allowedHtmlPolicy: 'safe_inline_html',
      fields: [
        { name: 'Prompt', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'Answer', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
      ],
    },
  });

  const draft = await callTool('create_draft', {
    profileId,
    clientRequestId: `real-e2e-${Date.now()}`,
    cardTypeId: 'e2e.v1.basic',
    fields: {
      Prompt: 'E2E test prompt',
      Answer: 'E2E test answer',
    },
  });

  const preview = await callTool('open_draft_preview', {
    profileId,
    draftId: draft.draft.draftId,
  });

  writeFileSync(statePath, JSON.stringify({
    profileId,
    draftId: draft.draft.draftId,
    noteId: draft.draft.noteId,
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    scenario: 'start',
    mode,
    statePath,
    draftId: draft.draft.draftId,
    noteId: draft.draft.noteId,
    preview: preview.preview,
    nextStep: 'Inspect the preview in Anki, then rerun with ANKI_E2E_SCENARIO=finalize and ANKI_E2E_FINALIZE=commit|discard.',
  }, null, 2));
}

async function runBatchStart() {
  await callTool('upsert_note_type', {
    profileId,
    modelName: 'e2e.v1.basic',
    dryRun: false,
    fields: [{ name: 'Prompt' }, { name: 'Answer' }],
    templates: [{
      name: 'Card 1',
      front: '<div class="e2e">{{Prompt}}</div>',
      back: '{{FrontSide}}<hr id="answer"><div>{{Answer}}</div>',
    }],
    css: '.card { background: #10151d; color: #edf3fb; font-family: "Avenir Next", "Noto Sans JP", sans-serif; padding: 16px; } .e2e { font-size: 18px; line-height: 1.6; }',
  });

  await callTool('upsert_card_type_definition', {
    profileId,
    definition: {
      cardTypeId: 'e2e.v1.basic',
      label: 'E2E Basic',
      modelName: 'e2e.v1.basic',
      defaultDeck: 'Testing::E2E',
      requiredFields: ['Prompt', 'Answer'],
      optionalFields: [],
      renderIntent: 'production',
      allowedHtmlPolicy: 'safe_inline_html',
      fields: [
        { name: 'Prompt', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'Answer', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
      ],
    },
  });

  const now = Date.now();
  const draft = await callTool('create_drafts_batch', {
    profileId,
    items: [
      {
        itemId: 'batch-1',
        clientRequestId: `real-e2e-batch-1-${now}`,
        cardTypeId: 'e2e.v1.basic',
        fields: { Prompt: 'E2E batch prompt 1', Answer: 'E2E batch answer 1' },
      },
      {
        itemId: 'batch-2',
        clientRequestId: `real-e2e-batch-2-${now}`,
        cardTypeId: 'e2e.v1.basic',
        fields: { Prompt: 'E2E batch prompt 2', Answer: 'E2E batch answer 2' },
      },
    ],
  });

  const firstSuccess = draft.results.find((item) => item.ok);
  const preview = firstSuccess
    ? await callTool('open_draft_preview', { profileId, draftId: firstSuccess.draft.draftId })
    : null;

  writeFileSync(statePath, JSON.stringify({
    profileId,
    mode,
    items: draft.results
      .filter((item) => item.ok)
      .map((item) => ({ itemId: item.itemId, draftId: item.draft.draftId, noteId: item.draft.noteId })),
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    scenario: 'start',
    mode,
    statePath,
    summary: draft.summary,
    preview: preview?.preview ?? null,
    nextStep: 'Rerun with ANKI_E2E_SCENARIO=finalize and ANKI_E2E_FINALIZE=commit|discard to finalize the draft batch.',
  }, null, 2));
}

async function runFinalize() {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  let result;

  if (state.mode === 'batch') {
    if (finalize === 'commit') {
      result = await callTool('commit_drafts_batch', {
        profileId: state.profileId,
        items: state.items.map((item) => ({
          itemId: item.itemId,
          draftId: item.draftId,
          reviewDecision: {
            targetIdentityMatched: true,
            questionConfirmed: true,
            answerConfirmed: true,
            reviewedAt: new Date().toISOString(),
            reviewer: 'user',
          },
        })),
      });
    } else {
      result = await callTool('discard_drafts_batch', {
        profileId: state.profileId,
        items: state.items.map((item) => ({
          itemId: item.itemId,
          draftId: item.draftId,
          reason: 'user_request',
        })),
      });
    }
  } else {
    if (finalize === 'commit') {
      result = await callTool('commit_draft', {
        profileId: state.profileId,
        draftId: state.draftId,
        reviewDecision: {
          targetIdentityMatched: true,
          questionConfirmed: true,
          answerConfirmed: true,
          reviewedAt: new Date().toISOString(),
          reviewer: 'user',
        },
      });
    } else {
      result = await callTool('discard_draft', {
        profileId: state.profileId,
        draftId: state.draftId,
        reason: 'user_request',
      });
    }
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
      await runStart();
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
