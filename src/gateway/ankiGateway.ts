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

export type NoteTypeSummaryResult = {
  modelName: string;
  fieldNames: string[];
  templateNames: string[];
  isCloze: boolean;
};

export type NoteTypeSchemaResult = {
  modelName: string;
  fieldNames: string[];
  templates: Array<{
    name: string;
    front: string;
    back: string;
  }>;
  css: string;
  fieldsOnTemplates: Record<
    string,
    {
      front: string[];
      back: string[];
    }
  >;
  isCloze: boolean;
};

export type UpsertNoteTypeInput = {
  modelName: string;
  fieldNames: string[];
  templates: Array<{
    name: string;
    front: string;
    back: string;
  }>;
  css: string;
  isCloze: boolean;
  newFieldNames: string[];
  newTemplates: Array<{
    name: string;
    front: string;
    back: string;
  }>;
};

export interface AnkiGateway {
  createNote(input: CreateNoteInput): Promise<CreateNoteResult>;
  getNoteSnapshot(noteId: number): Promise<NoteSnapshot>;
  openBrowserForNote(noteId: number): Promise<PreviewResult>;
  listNoteTypes(): Promise<NoteTypeSummaryResult[]>;
  getNoteTypeSchema(modelName: string): Promise<NoteTypeSchemaResult>;
  upsertNoteType(input: UpsertNoteTypeInput): Promise<NoteTypeSchemaResult>;
  applyStagedIsolation(noteId: number, cardIds: number[], stagedTag: string): Promise<void>;
  releaseStagedIsolation(noteId: number, cardIds: number[], stagedTag: string): Promise<void>;
  deleteNote(noteId: number): Promise<void>;
}
