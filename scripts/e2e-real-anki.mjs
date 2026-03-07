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

  const staged = await callTool('create_staged_card', {
    profileId,
    clientRequestId: `real-e2e-${Date.now()}`,
    cardTypeId: 'e2e.v1.basic',
    fields: {
      Prompt: 'E2E test prompt',
      Answer: 'E2E test answer',
    },
  });

  const preview = await callTool('open_staged_card_preview', {
    profileId,
    draftId: staged.draft.draftId,
  });

  writeFileSync(statePath, JSON.stringify({
    profileId,
    draftId: staged.draft.draftId,
    noteId: staged.draft.noteId,
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    scenario: 'start',
    statePath,
    draftId: staged.draft.draftId,
    noteId: staged.draft.noteId,
    preview: preview.preview,
    nextStep: 'Inspect the preview in Anki, then rerun with ANKI_E2E_SCENARIO=finalize and ANKI_E2E_FINALIZE=commit|discard.',
  }, null, 2));
}

async function runFinalize() {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  let result;

  if (finalize === 'commit') {
    result = await callTool('commit_staged_card', {
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
    result = await callTool('discard_staged_card', {
      profileId: state.profileId,
      draftId: state.draftId,
      reason: 'user_request',
    });
  }

  rmSync(statePath, { force: true });
  console.log(JSON.stringify({
    ok: true,
    scenario: 'finalize',
    finalize,
    result,
  }, null, 2));
}

try {
  await client.connect(transport);
  if (scenario === 'start') {
    await runStart();
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
