import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppError } from '../src/contracts/errors.js';
import { MemoryGateway } from '../src/gateway/memoryGateway.js';
import { AuthoringStore } from '../src/persistence/authoringStore.js';
import { NoteAuthoringService } from '../src/services/noteAuthoringService.js';
import { NoteTypeService } from '../src/services/noteTypeService.js';

const dbPath = resolve(process.cwd(), '.data/test-note-authoring.sqlite');

afterEach(() => {
  rmSync(dbPath, { force: true });
});

function createServices() {
  const store = new AuthoringStore(dbPath);
  const gateway = new MemoryGateway();
  const noteTypeService = new NoteTypeService(gateway, { activeProfileId: 'default' });
  const noteAuthoringService = new NoteAuthoringService(store, gateway, { activeProfileId: 'default' });
  return { store, gateway, noteTypeService, noteAuthoringService };
}

describe('NoteAuthoringService', () => {
  it('lists decks, ensures a deck, adds a note, and exposes it via search/get', async () => {
    const { store, noteTypeService, noteAuthoringService } = createServices();

    await noteTypeService.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.concept',
      dryRun: false,
      fields: [{ name: 'Prompt' }, { name: 'Answer' }],
      templates: [{ name: 'Card 1', front: '{{Prompt}}', back: '{{FrontSide}}<hr id=answer>{{Answer}}' }],
    });

    const before = await noteAuthoringService.listDecks({ profileId: 'default' });
    expect(before.decks.map((deck) => deck.deckName)).toEqual(['Default']);

    const ensured = await noteAuthoringService.ensureDeck({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
    });
    expect(ensured.created).toBe(true);

    const added = await noteAuthoringService.addNote({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
      modelName: 'ts.v1.concept',
      fields: {
        Prompt: 'any と unknown の違いは？',
        Answer: 'unknown は絞り込み後に使います。',
      },
      tags: ['language::typescript', 'card::concept'],
    });

    expect(added.reviewPending).toBe(true);
    expect(added.note.deckName).toBe('Programming::TypeScript::Concept');

    const searched = await noteAuthoringService.searchNotes({
      profileId: 'default',
      deckNames: ['Programming::TypeScript::Concept'],
    });
    expect(searched.notes.map((note) => note.noteId)).toContain(added.note.noteId);

    const inspected = await noteAuthoringService.getNotes({
      profileId: 'default',
      noteIds: [added.note.noteId],
    });
    expect(inspected.results[0]).toMatchObject({
      noteId: added.note.noteId,
      ok: true,
    });

    store.close();
  });

  it('replays add_note idempotently for the same clientRequestId and payload', async () => {
    const { store, noteTypeService, noteAuthoringService } = createServices();

    await noteTypeService.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.output',
      dryRun: false,
      fields: [{ name: 'Code' }, { name: 'Expected' }],
      templates: [{ name: 'Card 1', front: '{{Code}}', back: '{{FrontSide}}<hr id=answer>{{Expected}}' }],
    });
    await noteAuthoringService.ensureDeck({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Output',
    });

    const first = await noteAuthoringService.addNote({
      profileId: 'default',
      clientRequestId: 'idempotent-1',
      deckName: 'Programming::TypeScript::Output',
      modelName: 'ts.v1.output',
      fields: { Code: 'console.log(1 + 1)', Expected: '2' },
    });

    const second = await noteAuthoringService.addNote({
      profileId: 'default',
      clientRequestId: 'idempotent-1',
      deckName: 'Programming::TypeScript::Output',
      modelName: 'ts.v1.output',
      fields: { Code: 'console.log(1 + 1)', Expected: '2' },
    });

    expect(second.note.noteId).toBe(first.note.noteId);
    expect(second.idempotentReplay).toBe(true);

    store.close();
  });

  it('rejects unknown fields and stale updates with structured conflicts', async () => {
    const { store, gateway, noteTypeService, noteAuthoringService } = createServices();

    await noteTypeService.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.debug',
      dryRun: false,
      fields: [{ name: 'BuggyCode' }, { name: 'Fix' }],
      templates: [{ name: 'Card 1', front: '{{BuggyCode}}', back: '{{FrontSide}}<hr id=answer>{{Fix}}' }],
    });
    await noteAuthoringService.ensureDeck({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Debug',
    });

    await expect(
      noteAuthoringService.addNote({
        profileId: 'default',
        deckName: 'Programming::TypeScript::Debug',
        modelName: 'ts.v1.debug',
        fields: { WrongField: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    const added = await noteAuthoringService.addNote({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Debug',
      modelName: 'ts.v1.debug',
      fields: {
        BuggyCode: 'const value: any = 1;',
        Fix: 'const value: unknown = 1;',
      },
    });

    gateway.mutateNote(added.note.noteId, (note) => {
      note.fields.Fix = 'manual edit';
    });

    await expect(
      noteAuthoringService.updateNote({
        profileId: 'default',
        noteId: added.note.noteId,
        expectedModTimestamp: added.note.modTimestamp,
        fields: { Fix: 'agent edit' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    store.close();
  });

  it('rejects update_note when tag changes do not persist', async () => {
    const store = new AuthoringStore(dbPath);
    const gateway = new MemoryGateway();
    const noteTypeService = new NoteTypeService(gateway, { activeProfileId: 'default' });
    const noteAuthoringService = new NoteAuthoringService(store, gateway, { activeProfileId: 'default' });

    await noteTypeService.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.concept',
      dryRun: false,
      fields: [{ name: 'Prompt' }, { name: 'Answer' }],
      templates: [{ name: 'Card 1', front: '{{Prompt}}', back: '{{FrontSide}}<hr id=answer>{{Answer}}' }],
    });
    await noteAuthoringService.ensureDeck({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
    });

    const added = await noteAuthoringService.addNote({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
      modelName: 'ts.v1.concept',
      fields: {
        Prompt: 'any と unknown の違いは？',
        Answer: 'unknown は絞り込み後に使います。',
      },
      tags: ['language::typescript'],
    });

    gateway.replaceNoteTags = async () => {
      // Simulate a dependency that accepts the request but leaves persisted tags unchanged.
    };

    await expect(
      noteAuthoringService.updateNote({
        profileId: 'default',
        noteId: added.note.noteId,
        expectedModTimestamp: added.note.modTimestamp,
        tags: ['language::typescript', 'reviewed'],
      }),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });

    store.close();
  });

  it('rejects update_note when tags briefly appear and then revert', async () => {
    const store = new AuthoringStore(dbPath);
    const gateway = new MemoryGateway();
    const noteTypeService = new NoteTypeService(gateway, { activeProfileId: 'default' });
    const noteAuthoringService = new NoteAuthoringService(store, gateway, {
      activeProfileId: 'default',
      tagReadbackAttempts: 3,
      tagReadbackDelayMs: 0,
    });

    await noteTypeService.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.concept',
      dryRun: false,
      fields: [{ name: 'Prompt' }, { name: 'Answer' }],
      templates: [{ name: 'Card 1', front: '{{Prompt}}', back: '{{FrontSide}}<hr id=answer>{{Answer}}' }],
    });
    await noteAuthoringService.ensureDeck({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
    });

    const added = await noteAuthoringService.addNote({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
      modelName: 'ts.v1.concept',
      fields: {
        Prompt: 'interface と type の違いは？',
        Answer: '用途次第です。',
      },
      tags: ['language::typescript'],
    });

    const originalGetNoteSnapshot = gateway.getNoteSnapshot.bind(gateway);
    let readCountAfterUpdate = 0;
    gateway.replaceNoteTags = async (_noteId, _currentTags, nextTags) => {
      gateway.mutateNote(added.note.noteId, (note) => {
        note.tags = [...nextTags];
      });
    };
    gateway.getNoteSnapshot = async (noteId) => {
      const snapshot = await originalGetNoteSnapshot(noteId);
      if (noteId !== added.note.noteId || readCountAfterUpdate >= 2) {
        return snapshot;
      }
      readCountAfterUpdate += 1;
      if (readCountAfterUpdate === 2) {
        gateway.mutateNote(added.note.noteId, (note) => {
          note.tags = ['language::typescript'];
        });
      }
      return snapshot;
    };

    await expect(
      noteAuthoringService.updateNote({
        profileId: 'default',
        noteId: added.note.noteId,
        expectedModTimestamp: added.note.modTimestamp,
        tags: ['language::typescript', 'reviewed'],
      }),
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });

    store.close();
  });

  it('deletes notes idempotently in batch form', async () => {
    const { store, noteTypeService, noteAuthoringService } = createServices();

    await noteTypeService.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.concept',
      dryRun: false,
      fields: [{ name: 'Prompt' }, { name: 'Answer' }],
      templates: [{ name: 'Card 1', front: '{{Prompt}}', back: '{{FrontSide}}<hr id=answer>{{Answer}}' }],
    });
    await noteAuthoringService.ensureDeck({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
    });

    const added = await noteAuthoringService.addNote({
      profileId: 'default',
      deckName: 'Programming::TypeScript::Concept',
      modelName: 'ts.v1.concept',
      fields: {
        Prompt: 'interface と type の違いは？',
        Answer: '拡張方法と表現力の差があります。',
      },
    });

    const deleted = await noteAuthoringService.deleteNotesBatch({
      profileId: 'default',
      items: [
        { itemId: 'existing', noteId: added.note.noteId },
        { itemId: 'missing', noteId: 999999 },
      ],
    });

    expect(deleted.summary).toEqual({ succeeded: 2, failed: 0 });
    expect(deleted.results.find((item) => item.itemId === 'existing')).toMatchObject({
      ok: true,
      status: 'deleted',
    });
    expect(deleted.results.find((item) => item.itemId === 'missing')).toMatchObject({
      ok: true,
      status: 'already_deleted',
    });

    store.close();
  });

  it('requires explicit profileId for writes', async () => {
    const { store, noteAuthoringService } = createServices();

    let error: unknown;
    try {
      await noteAuthoringService.ensureDeck({
        profileId: '' as never,
        deckName: 'Programming::TypeScript::Concept',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('PROFILE_REQUIRED');

    store.close();
  });

  it('rejects profileId that does not match the active profile', async () => {
    const store = new AuthoringStore(dbPath);
    const gateway = new MemoryGateway();
    const noteAuthoringService = new NoteAuthoringService(store, gateway, { activeProfileId: 'default' });

    await expect(
      noteAuthoringService.ensureDeck({
        profileId: 'other-profile',
        deckName: 'Programming::TypeScript::Concept',
      }),
    ).rejects.toMatchObject({ code: 'PROFILE_SCOPE_MISMATCH' });

    store.close();
  });
});
