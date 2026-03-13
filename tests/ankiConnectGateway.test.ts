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

        if (body.action === 'apiReflect') return ok({ actions: ['guiPreviewNote'] });
        if (body.action === 'findCards') return ok([3001]);
        if (body.action === 'guiPreviewNote') return ok(true);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await gateway.openBrowserForNote(777);
    await gateway.openBrowserForNote(778);

    const names = calls.map((c) => c.action);
    expect(names).toEqual([
      'apiReflect',
      'findCards',
      'guiPreviewNote',
      'findCards',
      'guiPreviewNote',
    ]);
  });

  it('reports runtime capabilities with extension preview when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string };
        if (body.action === 'version') return ok(6);
        if (body.action === 'apiReflect') return ok({ actions: ['guiPreviewNote'] });
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await expect(gateway.getRuntimeCapabilities()).resolves.toEqual({
      gatewayMode: 'anki-connect',
      endpoint: 'http://127.0.0.1:8765',
      ankiConnectReachable: true,
      extensionInstalled: true,
      previewMode: 'extension-preview',
    });
  });

  it('reports unreachable runtime capabilities when AnkiConnect is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await expect(gateway.getRuntimeCapabilities()).resolves.toEqual({
      gatewayMode: 'anki-connect',
      endpoint: 'http://127.0.0.1:8765',
      ankiConnectReachable: false,
      extensionInstalled: false,
      previewMode: 'unavailable',
    });
  });

  it('closes note dialog when extension close action is available', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'apiReflect') return ok({ actions: ['guiCloseNoteDialog'] });
        if (body.action === 'guiCloseNoteDialog') return ok(true);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await expect(gateway.closeNoteDialog(777)).resolves.toBe(true);
    await expect(gateway.closeNoteDialog(778)).resolves.toBe(true);

    expect(calls.map((c) => c.action)).toEqual([
      'apiReflect',
      'guiCloseNoteDialog',
      'guiCloseNoteDialog',
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

    expect(calls.map((c) => c.action)).toEqual(['apiReflect', 'guiBrowse', 'guiSelectCard', 'guiEditNote']);
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
            'Card 1': [['Prompt'], ['Answer']],
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

  it('falls back to legacy field mapping shape for note type schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };

        if (body.action === 'modelNames') return ok(['ts.v1.concept']);
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

    expect(schema.fieldsOnTemplates['Card 1']).toEqual({ front: ['Prompt'], back: ['Answer'] });
  });

  it('lists note types with lightweight summary requests instead of full schema fan-out', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'modelNames') return ok(['Basic', 'Cloze']);
        if (body.action === 'modelFieldNames' && body.params.modelName === 'Basic') return ok(['Front', 'Back']);
        if (body.action === 'modelFieldNames' && body.params.modelName === 'Cloze') return ok(['Text', 'Extra']);
        if (body.action === 'modelTemplates' && body.params.modelName === 'Basic') {
          return ok({
            'Card 1': {
              Front: '{{Front}}',
              Back: '{{FrontSide}}<hr id=answer>{{Back}}',
            },
          });
        }
        if (body.action === 'modelTemplates' && body.params.modelName === 'Cloze') {
          return ok({
            Cloze: {
              Front: '{{cloze:Text}}',
              Back: '{{cloze:Text}}<br>{{Extra}}',
            },
          });
        }
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await expect(gateway.listNoteTypes()).resolves.toEqual([
      {
        modelName: 'Basic',
        fieldNames: ['Front', 'Back'],
        templateNames: ['Card 1'],
        isCloze: false,
      },
      {
        modelName: 'Cloze',
        fieldNames: ['Text', 'Extra'],
        templateNames: ['Cloze'],
        isCloze: true,
      },
    ]);

    expect(calls.map((call) => call.action)).toEqual([
      'modelNames',
      'modelFieldNames',
      'modelTemplates',
      'modelFieldNames',
      'modelTemplates',
    ]);
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
            'Card 1': [['Code'], ['Expected']],
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

  it('stores media files and lists media names through AnkiConnect actions', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'getMediaFilesNames') return ok(['mcp-audio-deadbeef.mp3']);
        if (body.action === 'storeMediaFile') return ok('mcp-audio-deadbeef.mp3');
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    const names = await gateway.listMediaFiles('mcp-*');
    const stored = await gateway.storeMediaFile({ filename: 'mcp-audio-deadbeef.mp3', path: '/tmp/test.mp3' });

    expect(names).toEqual(['mcp-audio-deadbeef.mp3']);
    expect(stored.storedFilename).toBe('mcp-audio-deadbeef.mp3');
    expect(calls.map((call) => call.action)).toEqual(['getMediaFilesNames', 'storeMediaFile']);
  });

  it('updates note tags using add/remove diffs only', async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string; params: Record<string, unknown> };
        calls.push({ action: body.action, params: body.params });

        if (body.action === 'removeTags') return ok(null);
        if (body.action === 'addTags') return ok(null);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await gateway.replaceNoteTags(1001, ['tag-a', 'tag-b'], ['tag-b', 'tag-c']);

    expect(calls).toEqual([
      { action: 'removeTags', params: { notes: [1001], tags: 'tag-a' } },
      { action: 'addTags', params: { notes: [1001], tags: 'tag-c' } },
    ]);
  });

  it('treats deleted-note placeholders as NOT_FOUND', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { action: string };
        if (body.action === 'notesInfo') return ok([{}]);
        throw new Error(`unexpected action: ${body.action}`);
      }),
    );

    const gateway = new AnkiConnectGateway('http://127.0.0.1:8765');
    await expect(gateway.getNoteSnapshot(404)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
