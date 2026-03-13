export type NoteTypeField = {
  name: string;
  description?: string;
};

export type NoteTypeTemplate = {
  name: string;
  front: string;
  back: string;
};

export type NoteTypeFieldsOnTemplates = Record<
  string,
  {
    front: string[];
    back: string[];
  }
>;

export type NoteTypeSummary = {
  modelName: string;
  fieldNames: string[];
  templateNames: string[];
  isCloze: boolean;
};

export type NoteTypeSchema = {
  modelName: string;
  fields: NoteTypeField[];
  templates: NoteTypeTemplate[];
  css: string;
  fieldsOnTemplates: NoteTypeFieldsOnTemplates;
  isCloze: boolean;
};

export type NoteTypeUpsertOperation =
  | { kind: 'create_model'; modelName: string }
  | { kind: 'add_field'; modelName: string; fieldName: string }
  | { kind: 'add_template'; modelName: string; templateName: string }
  | { kind: 'update_templates'; modelName: string; templateNames: string[] }
  | { kind: 'update_css'; modelName: string };

export type NoteTypeLintIssue = {
  code:
    | 'UNKNOWN_FIELD_REF'
    | 'UNBALANCED_SECTION_TAG'
    | 'INVALID_SECTION_NESTING'
    | 'INVALID_CLOZE_USAGE'
    | 'INVALID_CSS_SYNTAX'
    | 'DUPLICATE_FIELD_NAME'
    | 'DUPLICATE_TEMPLATE_NAME'
    | 'UNUSED_FIELD'
    | 'LARGE_TEMPLATE'
    | 'LARGE_CSS'
    | 'DEEP_SECTION_NESTING'
    | 'SUSPICIOUS_HTML_STRUCTURE'
    | 'MISSING_FRONTSIDE_ON_BACK';
  message: string;
  location?: {
    templateName?: string;
    side: 'front' | 'back' | 'css' | 'note_type';
    fieldName?: string;
  };
};

export type NoteTypeValidation = {
  canApply: boolean;
  errors: NoteTypeLintIssue[];
  warnings: NoteTypeLintIssue[];
};

export type DeckSummary = {
  deckName: string;
};

export type NoteSummary = {
  noteId: number;
  modelName: string;
  deckName: string;
  tags: string[];
  cardIds: number[];
  modTimestamp: number;
};

export type NoteRecord = NoteSummary & {
  fields: Record<string, string>;
};

export type BatchResultSummary = {
  succeeded: number;
  failed: number;
};

export type MediaKind = 'audio' | 'image';

export type ImportedMediaAsset = {
  mediaKind: MediaKind;
  sha256: string;
  storedFilename: string;
  fieldValue: string;
  alreadyExisted: boolean;
};
