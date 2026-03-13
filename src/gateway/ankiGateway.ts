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
  deckName: string;
  fields: Record<string, string>;
  tags: string[];
  modTimestamp: number;
};

export type PreviewResult = {
  opened: boolean;
  browserQuery: string;
  selectedCardIds: number[];
};

export type StoreMediaFileInput = {
  filename: string;
  path: string;
};

export type StoreMediaFileResult = {
  storedFilename: string;
};

export type RuntimeCapabilities = {
  gatewayMode: "anki-connect" | "memory";
  endpoint?: string;
  ankiConnectReachable: boolean;
  extensionInstalled: boolean;
  previewMode: "extension-preview" | "edit-dialog-fallback" | "memory" | "unavailable";
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
  getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
  listDecks(): Promise<string[]>;
  createDeck(deckName: string): Promise<void>;
  findNotes(query: string): Promise<number[]>;
  createNote(input: CreateNoteInput): Promise<CreateNoteResult>;
  getNoteSnapshot(noteId: number): Promise<NoteSnapshot>;
  updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void>;
  replaceNoteTags(noteId: number, currentTags: string[], nextTags: string[]): Promise<void>;
  setCardsSuspended(cardIds: number[], suspended: boolean): Promise<void>;
  openBrowserForNote(noteId: number): Promise<PreviewResult>;
  closeNoteDialog(noteId: number): Promise<boolean>;
  listNoteTypes(): Promise<NoteTypeSummaryResult[]>;
  getNoteTypeSchema(modelName: string): Promise<NoteTypeSchemaResult>;
  upsertNoteType(input: UpsertNoteTypeInput): Promise<NoteTypeSchemaResult>;
  listMediaFiles(pattern: string): Promise<string[]>;
  storeMediaFile(input: StoreMediaFileInput): Promise<StoreMediaFileResult>;
  deleteNote(noteId: number): Promise<void>;
}
