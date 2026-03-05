import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnkiConnectGateway } from '../src/gateway/ankiConnectGateway.js';

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
});
