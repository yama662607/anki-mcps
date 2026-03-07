import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnkiConnectGateway } from '../src/gateway/ankiConnectGateway.js';
import { AppError } from '../src/contracts/errors.js';

type FetchCall = { action: string; params: Record<string, unknown> };

function ok(result: unknown) {
  return {
    ok: true,
    json: async () => ({ result, error: null }),
  } as Response;
}

function err(message: string) {
  return {
    ok: true,
    json: async () => ({ result: null, error: message }),
  } as Response;
}

describe('AnkiConnectGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates deck before adding note', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'createDeck') return ok(123);
        if (body.action === 'addNote') return ok(1001);
        if (body.action === 'findCards') return ok([2001]);
        if (body.action === 'notesInfo') return ok([{ noteId: 1001, mod: 999, fields: {}, tags: [], modelName: 'Basic' }]);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await gateway.createNote({
      deckName: 'Programming::TypeScript::Concept',
      modelName: 'Basic',
      fields: { Front: 'Q', Back: 'A' },
      tags: ['x'],
    });

    expect(calls.map((c) => c.action)).toEqual(['createDeck', 'addNote', 'findCards', 'notesInfo']);
    expect(calls[0]?.params).toEqual({ deck: 'Programming::TypeScript::Concept' });
  });

  it('uses guiPreviewNote when extension action is available', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'guiBrowse') return ok([3001]);
        if (body.action === 'guiSelectCard') return ok(true);
        if (body.action === 'apiReflect') return ok({ actions: ['guiPreviewNote'] });
        if (body.action === 'guiPreviewNote') return ok(true);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await gateway.openBrowserForNote(777);
    await gateway.openBrowserForNote(778);

    const names = calls.map((c) => c.action);
    expect(names).toEqual([
      'guiBrowse',
      'guiSelectCard',
      'apiReflect',
      'guiPreviewNote',
      'guiBrowse',
      'guiSelectCard',
      'guiPreviewNote',
    ]);
  });

  it('falls back to guiEditNote when extension action is unavailable', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'guiBrowse') return ok([3010]);
        if (body.action === 'guiSelectCard') return ok(true);
        if (body.action === 'apiReflect') return err('unsupported action');
        if (body.action === 'guiEditNote') return ok(null);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await gateway.openBrowserForNote(888);

    expect(calls.map((c) => c.action)).toEqual(['guiBrowse', 'guiSelectCard', 'apiReflect', 'guiEditNote']);
  });

  it('reads note type schema from model actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };

        if (body.action === 'modelNames') return ok(['Basic', 'ts.v1.concept']);
        if (body.action === 'modelFieldNames') return ok(['Prompt', 'Answer']);
        if (body.action === 'modelTemplates') {
          return ok({
            'Card 1': {
              Front: '{{Prompt}}',
              Back: '{{FrontSide}}<hr id=answer>{{Answer}}',
            },
          });
        }
        if (body.action === 'modelStyling') return ok({ css: '.card { color: black; }' });
        if (body.action === 'modelFieldsOnTemplates') {
          return ok({
            'Card 1': [
              { field: 'Prompt', ord: 0 },
              { field: 'Answer', ord: 1 },
            ],
          });
        }
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    const schema = await gateway.getNoteTypeSchema('ts.v1.concept');

    expect(schema.modelName).toBe('ts.v1.concept');
    expect(schema.fieldNames).toEqual(['Prompt', 'Answer']);
    expect(schema.fieldsOnTemplates['Card 1']).toEqual({ front: ['Prompt'], back: ['Answer'] });
  });

  it('creates and updates note types through model actions', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'modelNames' && calls.filter((item) => item.action === 'modelNames').length === 1) {
          return ok(['Basic']);
        }
        if (body.action === 'createModel') return ok({ id: 1 });
        if (body.action === 'modelNames') return ok(['Basic', 'ts.v1.output']);
        if (body.action === 'modelFieldNames') return ok(['Code', 'Expected']);
        if (body.action === 'modelTemplates') {
          return ok({
            'Card 1': {
              Front: '{{Code}}',
              Back: '{{FrontSide}}<hr id=answer>{{Expected}}',
            },
          });
        }
        if (body.action === 'modelStyling') return ok({ css: '.card { color: black; }' });
        if (body.action === 'modelFieldsOnTemplates') {
          return ok({
            'Card 1': [
              { field: 'Code', ord: 0 },
              { field: 'Expected', ord: 1 },
            ],
          });
        }
        if (body.action === 'modelFieldAdd') return ok(null);
        if (body.action === 'modelTemplateAdd') return ok(null);
        if (body.action === 'updateModelTemplates') return ok(null);
        if (body.action === 'updateModelStyling') return ok(null);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await gateway.upsertNoteType({
      modelName: 'ts.v1.output',
      fieldNames: ['Code', 'Expected'],
      templates: [{ name: 'Card 1', front: '{{Code}}', back: '{{FrontSide}}<hr id=answer>{{Expected}}' }],
      css: '.card { color: black; }',
      isCloze: false,
      newFieldNames: [],
      newTemplates: [],
    });

    expect(calls.some((call) => call.action === 'createModel')).toBe(true);
  });

  it('wraps note type authoring action failures as DEPENDENCY_UNAVAILABLE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string };
        if (body.action === 'modelNames') return err('connection lost');
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');

    let error: unknown;
    try {
      await gateway.listNoteTypes();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('wraps fetch connection failures as DEPENDENCY_UNAVAILABLE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');

    let error: unknown;
    try {
      await gateway.listNoteTypes();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('wraps non-200 responses as DEPENDENCY_UNAVAILABLE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
      }) as Response),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');

    let error: unknown;
    try {
      await gateway.listNoteTypes();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('DEPENDENCY_UNAVAILABLE');
  });
});
