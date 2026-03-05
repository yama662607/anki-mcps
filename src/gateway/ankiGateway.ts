export type CreateNoteInput = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
};

export type CreateNoteResult = {
  noteId: number;
  cardIds: number[];
  modTimestamp: number;
};

export type NoteSnapshot = {
  noteId: number;
  cardIds: number[];
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  modTimestamp: number;
};

export type PreviewResult = {
  opened: boolean;
  browserQuery: string;
  selectedCardIds: number[];
};

export interface AnkiGateway {
  createNote(input: CreateNoteInput): Promise<CreateNoteResult>;
  getNoteSnapshot(noteId: number): Promise<NoteSnapshot>;
  openBrowserForNote(noteId: number): Promise<PreviewResult>;
  applyStagedIsolation(noteId: number, cardIds: number[], stagedTag: string): Promise<void>;
  releaseStagedIsolation(noteId: number, cardIds: number[], stagedTag: string): Promise<void>;
  deleteNote(noteId: number): Promise<void>;
}
