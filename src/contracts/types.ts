export type RenderIntent = 'recognition' | 'production' | 'cloze' | 'mixed';
export type AllowedHtmlPolicy = 'plain_text_only' | 'safe_inline_html' | 'trusted_html';

export type FieldKind = 'text' | 'markdown' | 'html' | 'audio_ref' | 'image_ref';

export type FieldSchema = {
  name: string;
  required: boolean;
  type: FieldKind;
  allowedHtmlPolicy: AllowedHtmlPolicy;
  minLength?: number;
  maxLength?: number;
  multiline?: boolean;
  example?: string;
  hint?: string;
};

export type CardTypeSummary = {
  cardTypeId: string;
  label: string;
  modelName: string;
  defaultDeck: string;
  requiredFields: string[];
  renderIntent: RenderIntent;
  allowedHtmlPolicy: AllowedHtmlPolicy;
  source?: 'builtin' | 'custom';
};

export type CardTypeDefinition = CardTypeSummary & {
  optionalFields: string[];
  fields: FieldSchema[];
};

export type ValidationIssue = {
  code: string;
  message: string;
  field?: string;
  hint?: string;
};

export type DraftState = 'staged' | 'superseded' | 'committed' | 'discarded';

export type DraftRecord = {
  draftId: string;
  profileId: string;
  noteId: number;
  cardIds: number[];
  state: DraftState;
  cardTypeId: string;
  fingerprint: string;
  supersedesDraftId?: string;
  chainDepth: number;
  fields: Record<string, string>;
  tags: string[];
  deckName: string;
  modTimestamp: number;
  clientRequestId: string;
  stagedMarkerTag: string;
  createdAt: string;
  updatedAt: string;
  committedAt?: string;
  discardedAt?: string;
};

export type DraftListItem = {
  draftId: string;
  noteId: number;
  state: DraftState;
  cardTypeId: string;
  supersedesDraftId?: string;
  chainDepth: number;
  createdAt: string;
  updatedAt: string;
};

export type ReviewDecision = {
  targetIdentityMatched: boolean;
  questionConfirmed: boolean;
  answerConfirmed: boolean;
  reviewedAt: string;
  reviewer: 'user' | 'agent';
};

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

export type CustomCardTypeDefinition = CardTypeDefinition & {
  source: 'custom';
  profileId: string;
  updatedAt: string;
};
