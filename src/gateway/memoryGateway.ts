import type { AnkiGateway, CreateNoteInput, CreateNoteResult, NoteSnapshot, PreviewResult } from './ankiGateway.js';

type InternalNote = {
  noteId: number;
  cardIds: number[];
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  modTimestamp: number;
  suspended: boolean;
};

export class MemoryGateway implements AnkiGateway {
  private nextNoteId = 1000;
  private nextCardId = 5000;
  private readonly notes = new Map<number, InternalNote>();

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
    const noteId = this.nextNoteId++;
    const cardIds = [this.nextCardId++];
    const note: InternalNote = {
      noteId,
      cardIds,
      modelName: input.modelName,
      fields: { ...input.fields },
      tags: [...input.tags],
      modTimestamp: Date.now(),
      suspended: false,
    };
    this.notes.set(noteId, note);
    return {
      noteId,
      cardIds,
      modTimestamp: note.modTimestamp,
    };
  }

  async getNoteSnapshot(noteId: number): Promise<NoteSnapshot> {
    const note = this.requireNote(noteId);
    return {
      noteId,
      cardIds: [...note.cardIds],
      modelName: note.modelName,
      fields: { ...note.fields },
      tags: [...note.tags],
      modTimestamp: note.modTimestamp,
    };
  }

  async openBrowserForNote(noteId: number): Promise<PreviewResult> {
    const note = this.requireNote(noteId);
    return {
      opened: true,
      browserQuery: `nid:${note.noteId}`,
      selectedCardIds: [...note.cardIds],
    };
  }

  async applyStagedIsolation(noteId: number, _cardIds: number[], _stagedTag: string): Promise<void> {
    const note = this.requireNote(noteId);
    note.suspended = true;
    note.modTimestamp = Date.now();
  }

  async releaseStagedIsolation(noteId: number, _cardIds: number[], stagedTag: string): Promise<void> {
    const note = this.requireNote(noteId);
    note.suspended = false;
    note.tags = note.tags.filter((tag) => tag !== stagedTag);
    note.modTimestamp = Date.now();
  }

  async deleteNote(noteId: number): Promise<void> {
    this.notes.delete(noteId);
  }

  mutateNote(noteId: number, updater: (note: InternalNote) => void): void {
    const note = this.requireNote(noteId);
    updater(note);
    note.modTimestamp = Date.now();
  }

  private requireNote(noteId: number): InternalNote {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }
    return note;
  }
}
