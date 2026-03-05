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
