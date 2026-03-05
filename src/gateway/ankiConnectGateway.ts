import { AppError } from '../contracts/errors.js';
import type { AnkiGateway, CreateNoteInput, CreateNoteResult, NoteSnapshot, PreviewResult } from './ankiGateway.js';

type AnkiResponse<T> = {
  result: T;
  error: string | null;
};

export class AnkiConnectGateway implements AnkiGateway {
  constructor(private readonly endpoint = process.env.ANKI_CONNECT_URL ?? 'http://127.0.0.1:8765') {}

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
    const noteId = await this.call<number>('addNote', {
      note: {
        deckName: input.deckName,
        modelName: input.modelName,
        fields: input.fields,
        tags: input.tags,
        options: {
          allowDuplicate: false,
        },
      },
    });

    const cardIds = await this.call<number[]>('findCards', { query: `nid:${noteId}` });
    const noteInfo = await this.getFirstNoteInfo(noteId);

    return {
      noteId,
      cardIds,
      modTimestamp: noteInfo.mod ?? Date.now(),
    };
  }

  async getNoteSnapshot(noteId: number): Promise<NoteSnapshot> {
    const noteInfo = await this.getFirstNoteInfo(noteId);
    const cardIds = await this.call<number[]>('findCards', { query: `nid:${noteId}` });

    const fields = Object.fromEntries(
      Object.entries(noteInfo.fields ?? {}).map(([name, payload]: [string, unknown]) => {
        const value = typeof payload === 'object' && payload !== null && 'value' in payload
          ? String((payload as { value: unknown }).value ?? '')
          : String(payload ?? '');
        return [name, value];
      }),
    );

    return {
      noteId,
      cardIds,
      modelName: noteInfo.modelName,
      fields,
      tags: (noteInfo.tags ?? []) as string[],
      modTimestamp: noteInfo.mod ?? Date.now(),
    };
  }

  async openBrowserForNote(noteId: number): Promise<PreviewResult> {
    const query = `nid:${noteId}`;
    const result = await this.call<unknown>('guiBrowse', { query });
    const selectedCardIds = Array.isArray(result) ? (result as number[]) : [];
    return {
      opened: true,
      browserQuery: query,
      selectedCardIds,
    };
  }

  async applyStagedIsolation(_noteId: number, cardIds: number[], _stagedTag: string): Promise<void> {
    if (cardIds.length > 0) {
      await this.call<boolean>('suspend', { cards: cardIds });
    }
  }

  async releaseStagedIsolation(noteId: number, cardIds: number[], stagedTag: string): Promise<void> {
    if (cardIds.length > 0) {
      await this.call<boolean>('unsuspend', { cards: cardIds });
    }
    await this.call<unknown>('removeTags', { notes: [noteId], tags: stagedTag });
  }

  async deleteNote(noteId: number): Promise<void> {
    await this.call<unknown>('deleteNotes', { notes: [noteId] });
  }

  private async getFirstNoteInfo(noteId: number): Promise<Record<string, any>> {
    const notes = await this.call<Record<string, any>[]>('notesInfo', { notes: [noteId] });
    const note = notes[0];
    if (!note) {
      throw new AppError('NOT_FOUND', `Note not found: ${noteId}`);
    }
    return note;
  }

  private async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, version: 6, params }),
      });
    } catch (error) {
      throw new AppError('DEPENDENCY_UNAVAILABLE', 'Failed to connect to AnkiConnect', {
        hint: 'Ensure Anki is running with AnkiConnect enabled.',
        context: { endpoint: this.endpoint, cause: String(error) },
      });
    }

    if (!response.ok) {
      throw new AppError('DEPENDENCY_UNAVAILABLE', `AnkiConnect HTTP error: ${response.status}`);
    }

    const payload = (await response.json()) as AnkiResponse<T>;
    if (payload.error) {
      throw new AppError('DEPENDENCY_UNAVAILABLE', `AnkiConnect action failed: ${action}`, {
        context: { error: payload.error, action },
      });
    }
    return payload.result;
  }
}
