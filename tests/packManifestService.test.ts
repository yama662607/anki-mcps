import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DraftStore } from '../src/persistence/draftStore.js';
import { PackManifestService } from '../src/services/packManifestService.js';
import type { StarterPackManifest } from '../src/contracts/types.js';

function createContext() {
  const dir = mkdtempSync(join(tmpdir(), 'anki-mcps-pack-service-'));
  const store = new DraftStore(join(dir, 'drafts.sqlite'));
  const service = new PackManifestService(store, { activeProfileId: 'default' });
  return { dir, store, service };
}

function exampleManifest(overrides: Partial<StarterPackManifest> = {}): StarterPackManifest {
  return {
    packId: 'custom.lang.ja-core',
    label: 'Japanese Core',
    version: '2026-03-12.v1',
    domains: ['japanese'],
    supportedOptions: [
      {
        name: 'deckRoot',
        type: 'string',
        required: false,
        description: 'Deck root',
        defaultValue: 'Languages::Japanese',
      },
    ],
    deckRoots: ['Languages::Japanese'],
    tagTemplates: {
      'language.v1.japanese-vocab': ['domain::japanese', 'skill::vocabulary'],
    },
    noteTypes: [
      {
        modelName: 'language.v1.japanese-vocab',
        fields: [{ name: 'Expression' }, { name: 'Meaning' }],
        templates: [
          {
            name: 'Card 1',
            front: '<div>{{Expression}}</div>',
            back: '{{FrontSide}}<hr id="answer"><div>{{Meaning}}</div>',
          },
        ],
        css: '.card { color: white; background: black; }',
      },
    ],
    cardTypes: [
      {
        cardTypeId: 'language.v1.japanese-vocab',
        label: 'Japanese Vocabulary',
        modelName: 'language.v1.japanese-vocab',
        defaultDeck: 'Languages::Japanese::Vocabulary',
        source: 'custom',
        requiredFields: ['Expression', 'Meaning'],
        optionalFields: [],
        renderIntent: 'recognition',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          { name: 'Expression', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
          { name: 'Meaning', required: true, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html', multiline: true },
        ],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  // explicit cleanup in each test
});

describe('PackManifestService', () => {
  it('upserts, lists, gets, and deprecates custom manifests', async () => {
    const { dir, store, service } = createContext();

    try {
      const upserted = await service.upsertPackManifest({
        profileId: 'default',
        manifest: exampleManifest(),
      });
      expect(upserted.pack.source).toBe('custom');

      const listed = await service.listPackManifests({ profileId: 'default' });
      expect(listed.items.map((item) => item.packId)).toEqual(['custom.lang.ja-core']);

      const fetched = await service.getPackManifest({
        profileId: 'default',
        packId: 'custom.lang.ja-core',
      });
      expect(fetched.pack.packId).toBe('custom.lang.ja-core');

      const deprecated = await service.deprecatePackManifest({
        profileId: 'default',
        packId: 'custom.lang.ja-core',
      });
      expect(deprecated.pack.status).toBe('deprecated');
      expect((await service.listPackManifests({ profileId: 'default' })).items).toEqual([]);
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects builtin pack id collisions', async () => {
    const { dir, store, service } = createContext();

    try {
      await expect(service.upsertPackManifest({
        profileId: 'default',
        manifest: exampleManifest({ packId: 'english-core' }),
      })).rejects.toMatchObject({ code: 'CONFLICT' });
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
