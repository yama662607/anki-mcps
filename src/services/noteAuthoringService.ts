import { AppError, asAppError } from '../contracts/errors.js';
import type { BatchResultSummary, DeckSummary, NoteRecord, NoteSummary } from '../contracts/types.js';
import type { AnkiGateway, NoteSnapshot } from '../gateway/ankiGateway.js';
import { AuthoringStore } from '../persistence/authoringStore.js';
import { normalizeTags, sortRecord, toCanonicalJson } from '../utils/canonical.js';
import { sha256 } from '../utils/hash.js';
import { resolveProfileId } from '../utils/profile.js';

type NoteAuthoringServiceConfig = {
  activeProfileId?: string;
  tagReadbackAttempts?: number;
  tagReadbackDelayMs?: number;
};

export class NoteAuthoringService {
  constructor(
    private readonly store: AuthoringStore,
    private readonly ankiGateway: AnkiGateway,
    private readonly config: NoteAuthoringServiceConfig,
  ) {}

  async listDecks(input: { profileId?: string }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    decks: DeckSummary[];
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    const decks = await this.ankiGateway.listDecks();
    return {
      contractVersion: '1.0.0',
      profileId,
      decks: decks.map((deckName) => ({ deckName })),
    };
  }

  async searchNotes(input: {
    profileId?: string;
    query?: string;
    modelNames?: string[];
    deckNames?: string[];
    tags?: string[];
    limit?: number;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    query: string;
    notes: NoteSummary[];
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    const query = this.buildSearchQuery(input);
    const noteIds = await this.ankiGateway.findNotes(query);
    const limitedIds = [...noteIds].sort((left, right) => left - right).slice(0, input.limit ?? 50);
    const notes = await Promise.all(limitedIds.map(async (noteId) => this.toNoteSummary(await this.ankiGateway.getNoteSnapshot(noteId))));

    return {
      contractVersion: '1.0.0',
      profileId,
      query,
      notes,
    };
  }

  async getNotes(input: {
    profileId?: string;
    noteIds: number[];
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    results: Array<
      | { noteId: number; ok: true; note: NoteRecord }
      | { noteId: number; ok: false; error: ReturnType<AppError['toPayload']> }
    >;
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    const results = await Promise.all(
      input.noteIds.map(async (noteId) => {
        try {
          const snapshot = await this.ankiGateway.getNoteSnapshot(noteId);
          return {
            noteId,
            ok: true as const,
            note: this.toNoteRecord(snapshot),
          };
        } catch (error) {
          return {
            noteId,
            ok: false as const,
            error: asAppError(error).toPayload(),
          };
        }
      }),
    );

    return {
      contractVersion: '1.0.0',
      profileId,
      results,
    };
  }

  async ensureDeck(input: {
    profileId: string;
    deckName: string;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    deckName: string;
    created: boolean;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    const existingDecks = await this.ankiGateway.listDecks();
    const created = !existingDecks.includes(input.deckName);
    if (created) {
      await this.ankiGateway.createDeck(input.deckName);
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      deckName: input.deckName,
      created,
    };
  }

  async addNote(input: {
    profileId: string;
    clientRequestId?: string;
    deckName: string;
    modelName: string;
    fields: Record<string, string>;
    tags?: string[];
    suspendNewCards?: boolean;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    reviewPending: boolean;
    note: NoteRecord;
    idempotentReplay?: boolean;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    const reviewPending = input.suspendNewCards ?? true;
    const requestFingerprint = this.computeCreateFingerprint(input);

    if (input.clientRequestId) {
      const existing = this.store.getNoteRequest(profileId, input.clientRequestId);
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          throw new AppError('CONFLICT', 'clientRequestId was reused with a different payload', {
            hint: 'Use a new clientRequestId when changing add_note content.',
          });
        }

        const snapshot = await this.ankiGateway.getNoteSnapshot(existing.noteId);
        return {
          contractVersion: '1.0.0',
          profileId,
          reviewPending,
          note: this.toNoteRecord(snapshot),
          idempotentReplay: true,
        };
      }
    }

    await this.assertDeckExists(input.deckName);
    const normalized = await this.normalizeForModel(input.modelName, input.fields, input.tags ?? []);
    const created = await this.ankiGateway.createNote({
      deckName: input.deckName,
      modelName: input.modelName,
      fields: normalized.fields,
      tags: normalized.tags,
    });

    if (reviewPending) {
      await this.ankiGateway.setCardsSuspended(created.cardIds, true);
    }

    const snapshot = await this.ankiGateway.getNoteSnapshot(created.noteId);

    if (input.clientRequestId) {
      this.store.insertNoteRequest({
        profileId,
        clientRequestId: input.clientRequestId,
        requestFingerprint,
        noteId: snapshot.noteId,
        createdAt: new Date().toISOString(),
      });
    }

    this.logLifecycleEvent('note_created', {
      profileId,
      noteId: snapshot.noteId,
      cardIds: snapshot.cardIds,
      reviewPending,
      modelName: snapshot.modelName,
      deckName: snapshot.deckName,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      reviewPending,
      note: this.toNoteRecord(snapshot),
    };
  }

  async addNotesBatch(input: {
    profileId: string;
    items: Array<{
      itemId: string;
      clientRequestId?: string;
      deckName: string;
      modelName: string;
      fields: Record<string, string>;
      tags?: string[];
      suspendNewCards?: boolean;
    }>;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    summary: BatchResultSummary;
    results: Array<
      | { itemId: string; ok: true; reviewPending: boolean; note: NoteRecord }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    >;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    const results = [];

    for (const item of input.items) {
      try {
        const result = await this.addNote({
          profileId,
          clientRequestId: item.clientRequestId,
          deckName: item.deckName,
          modelName: item.modelName,
          fields: item.fields,
          tags: item.tags,
          suspendNewCards: item.suspendNewCards,
        });
        results.push({
          itemId: item.itemId,
          ok: true as const,
          reviewPending: result.reviewPending,
          note: result.note,
        });
      } catch (error) {
        results.push({
          itemId: item.itemId,
          ok: false as const,
          error: asAppError(error).toPayload(),
        });
      }
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      summary: this.summarizeBatch(results),
      results,
    };
  }

  async updateNote(input: {
    profileId: string;
    noteId: number;
    expectedModTimestamp: number;
    fields?: Record<string, string>;
    tags?: string[];
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    note: NoteRecord;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    const snapshot = await this.ankiGateway.getNoteSnapshot(input.noteId);
    if (snapshot.modTimestamp !== input.expectedModTimestamp) {
      throw new AppError('CONFLICT', 'Live note changed since it was last read', {
        hint: 'Read the note again and retry with the current mod timestamp.',
        context: {
          noteId: input.noteId,
          expectedModTimestamp: input.expectedModTimestamp,
          liveModTimestamp: snapshot.modTimestamp,
        },
      });
    }

    const normalized = await this.normalizeForModel(
      snapshot.modelName,
      input.fields ? { ...snapshot.fields, ...input.fields } : snapshot.fields,
      input.tags ?? snapshot.tags,
    );

    if (input.fields) {
      await this.ankiGateway.updateNoteFields(input.noteId, normalized.fields);
    }

    if (input.tags) {
      await this.ankiGateway.replaceNoteTags(input.noteId, snapshot.tags, normalized.tags);
    }

    const updated = input.tags
      ? await this.readStableTaggedNote(input.noteId, normalized.tags)
      : await this.ankiGateway.getNoteSnapshot(input.noteId);
    this.logLifecycleEvent('note_updated', {
      profileId,
      noteId: updated.noteId,
      cardIds: updated.cardIds,
      modelName: updated.modelName,
      deckName: updated.deckName,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      note: this.toNoteRecord(updated),
    };
  }

  async deleteNote(input: {
    profileId: string;
    noteId: number;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    noteId: number;
    status: 'deleted' | 'already_deleted';
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);

    try {
      await this.ankiGateway.getNoteSnapshot(input.noteId);
      await this.ankiGateway.closeNoteDialog(input.noteId);
      await this.ankiGateway.deleteNote(input.noteId);
      this.logLifecycleEvent('note_deleted', {
        profileId,
        noteId: input.noteId,
      });
      return {
        contractVersion: '1.0.0',
        profileId,
        noteId: input.noteId,
        status: 'deleted',
      };
    } catch (error) {
      const appError = asAppError(error);
      if (appError.code !== 'NOT_FOUND') {
        throw appError;
      }
      return {
        contractVersion: '1.0.0',
        profileId,
        noteId: input.noteId,
        status: 'already_deleted',
      };
    }
  }

  async deleteNotesBatch(input: {
    profileId: string;
    items: Array<{ itemId: string; noteId: number }>;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    summary: BatchResultSummary;
    results: Array<
      | { itemId: string; ok: true; noteId: number; status: 'deleted' | 'already_deleted' }
      | { itemId: string; ok: false; error: ReturnType<AppError['toPayload']> }
    >;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    const results = [];

    for (const item of input.items) {
      try {
        const result = await this.deleteNote({ profileId, noteId: item.noteId });
        results.push({
          itemId: item.itemId,
          ok: true as const,
          noteId: result.noteId,
          status: result.status,
        });
      } catch (error) {
        results.push({
          itemId: item.itemId,
          ok: false as const,
          error: asAppError(error).toPayload(),
        });
      }
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      summary: this.summarizeBatch(results),
      results,
    };
  }

  async openNotePreview(input: {
    profileId?: string;
    noteId: number;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    noteId: number;
    preview: {
      opened: boolean;
      browserQuery: string;
      selectedCardIds: number[];
    };
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    await this.ankiGateway.getNoteSnapshot(input.noteId);
    const preview = await this.ankiGateway.openBrowserForNote(input.noteId);

    return {
      contractVersion: '1.0.0',
      profileId,
      noteId: input.noteId,
      preview,
    };
  }

  async setNoteCardsSuspended(input: {
    profileId: string;
    noteId: number;
    suspended: boolean;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    noteId: number;
    cardIds: number[];
    suspended: boolean;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    const snapshot = await this.ankiGateway.getNoteSnapshot(input.noteId);
    await this.ankiGateway.setCardsSuspended(snapshot.cardIds, input.suspended);

    this.logLifecycleEvent(input.suspended ? 'note_suspended' : 'note_unsuspended', {
      profileId,
      noteId: input.noteId,
      cardIds: snapshot.cardIds,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      noteId: input.noteId,
      cardIds: snapshot.cardIds,
      suspended: input.suspended,
    };
  }

  private resolveReadProfile(profileId?: string): string {
    return resolveProfileId({
      providedProfileId: profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });
  }

  private resolveWriteProfile(profileId?: string): string {
    return resolveProfileId({
      providedProfileId: profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });
  }

  private async assertDeckExists(deckName: string): Promise<void> {
    const decks = await this.ankiGateway.listDecks();
    if (!decks.includes(deckName)) {
      throw new AppError('NOT_FOUND', `Deck not found: ${deckName}`, {
        hint: 'Call ensure_deck before add_note when targeting a new deck.',
      });
    }
  }

  private async normalizeForModel(
    modelName: string,
    fields: Record<string, string>,
    tags: string[],
  ): Promise<{ fields: Record<string, string>; tags: string[] }> {
    const schema = await this.ankiGateway.getNoteTypeSchema(modelName);
    const schemaFields = new Set(schema.fieldNames);

    for (const fieldName of Object.keys(fields)) {
      if (!schemaFields.has(fieldName)) {
        throw new AppError('INVALID_ARGUMENT', `Unknown field for ${modelName}: ${fieldName}`);
      }
    }

    const normalizedFields = Object.fromEntries(
      schema.fieldNames.map((fieldName) => [fieldName, fields[fieldName] ?? '']),
    );

    if (schema.isCloze) {
      const hasCloze = Object.values(normalizedFields).some((value) => /\{\{c\d+::/.test(value));
      if (!hasCloze) {
        throw new AppError('INVALID_ARGUMENT', `Cloze note type requires at least one cloze deletion: ${modelName}`);
      }
    }

    return {
      fields: normalizedFields,
      tags: normalizeTags(tags),
    };
  }

  private buildSearchQuery(input: {
    query?: string;
    modelNames?: string[];
    deckNames?: string[];
    tags?: string[];
  }): string {
    const parts: string[] = [];

    if (input.query?.trim()) {
      parts.push(input.query.trim());
    }
    if (input.modelNames?.length) {
      parts.push(`(${input.modelNames.map((name) => `note:${this.quoteSearchValue(name)}`).join(' OR ')})`);
    }
    if (input.deckNames?.length) {
      parts.push(`(${input.deckNames.map((name) => `deck:${this.quoteSearchValue(name)}`).join(' OR ')})`);
    }
    if (input.tags?.length) {
      parts.push(`(${input.tags.map((tag) => `tag:${this.quoteSearchValue(tag)}`).join(' OR ')})`);
    }

    return parts.length > 0 ? parts.join(' ') : 'deck:*';
  }

  private quoteSearchValue(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  private computeCreateFingerprint(input: {
    deckName: string;
    modelName: string;
    fields: Record<string, string>;
    tags?: string[];
    suspendNewCards?: boolean;
  }): string {
    return sha256(
      toCanonicalJson({
        deckName: input.deckName,
        modelName: input.modelName,
        fields: sortRecord(input.fields),
        tags: normalizeTags(input.tags ?? []),
        suspendNewCards: input.suspendNewCards ?? true,
      }),
    );
  }

  private summarizeBatch(results: Array<{ ok: boolean }>): BatchResultSummary {
    return {
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
    };
  }

  private sameTags(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((tag, index) => tag === right[index]);
  }

  private async readStableTaggedNote(noteId: number, expectedTags: string[]): Promise<NoteSnapshot> {
    const attempts = Math.max(this.config.tagReadbackAttempts ?? 4, 2);
    const delayMs = Math.max(this.config.tagReadbackDelayMs ?? 120, 0);
    let lastSnapshot: NoteSnapshot | undefined;
    let consecutiveMatches = 0;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const snapshot = await this.ankiGateway.getNoteSnapshot(noteId);
      lastSnapshot = snapshot;

      if (this.sameTags(snapshot.tags, expectedTags)) {
        consecutiveMatches += 1;
        if (consecutiveMatches >= 2) {
          return snapshot;
        }
      } else {
        consecutiveMatches = 0;
      }

      if (attempt < attempts - 1) {
        await this.sleep(delayMs);
      }
    }

    throw new AppError('DEPENDENCY_UNAVAILABLE', 'Updated note tags did not persist in Anki', {
      hint: 'Read the note again before retrying. The Anki backend accepted the update but returned different tags.',
      context: {
        noteId,
        requestedTags: expectedTags,
        persistedTags: lastSnapshot?.tags ?? [],
      },
    });
  }

  private async sleep(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private toNoteSummary(snapshot: NoteSnapshot): NoteSummary {
    return {
      noteId: snapshot.noteId,
      modelName: snapshot.modelName,
      deckName: snapshot.deckName,
      tags: [...snapshot.tags],
      cardIds: [...snapshot.cardIds],
      modTimestamp: snapshot.modTimestamp,
    };
  }

  private toNoteRecord(snapshot: NoteSnapshot): NoteRecord {
    return {
      ...this.toNoteSummary(snapshot),
      fields: { ...snapshot.fields },
    };
  }

  private logLifecycleEvent(event: string, context: Record<string, unknown>): void {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...context,
    };
    console.error(JSON.stringify(payload));
  }
}
