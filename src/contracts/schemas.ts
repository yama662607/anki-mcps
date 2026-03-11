import { z } from 'zod';

export const contractVersion = '1.0.0' as const;

export const profileIdSchema = z.string().min(1).max(120);
export const cardTypeIdSchema = z.string().min(1).max(120);
export const draftIdSchema = z.string().min(1).max(120);
export const clientRequestIdSchema = z.string().min(1).max(120);
export const itemIdSchema = z.string().min(1).max(120);
export const modelNameSchema = z.string().min(1).max(180);
export const fieldNameSchema = z.string().min(1).max(180);
export const templateNameSchema = z.string().min(1).max(180);

export const draftStateSchema = z.enum(['draft', 'superseded', 'committed', 'discarded']);

export const reviewDecisionSchema = z
  .object({
    targetIdentityMatched: z.boolean(),
    questionConfirmed: z.boolean(),
    answerConfirmed: z.boolean(),
    reviewedAt: z.string().datetime(),
    reviewer: z.enum(['user', 'agent']),
  })
  .strict();

export const listCardTypesInputSchema = z.object({ profileId: profileIdSchema.optional() }).strict();

export const listCardTypeDefinitionsInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
    includeDeprecated: z.boolean().optional(),
  })
  .strict();

export const listNoteTypesInputSchema = z.object({ profileId: profileIdSchema.optional() }).strict();

export const getNoteTypeSchemaInputSchema = z
  .object({
    modelName: modelNameSchema,
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const noteTypeFieldInputSchema = z
  .object({
    name: fieldNameSchema,
    description: z.string().max(1000).optional(),
  })
  .strict();

export const noteTypeTemplateInputSchema = z
  .object({
    name: templateNameSchema,
    front: z.string(),
    back: z.string(),
  })
  .strict();

export const upsertNoteTypeInputSchema = z
  .object({
    profileId: profileIdSchema,
    modelName: modelNameSchema,
    fields: z.array(noteTypeFieldInputSchema).min(1),
    templates: z.array(noteTypeTemplateInputSchema).min(1),
    css: z.string().optional(),
    isCloze: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

export const upsertCardTypeDefinitionInputSchema = z
  .object({
    profileId: profileIdSchema,
    definition: z
      .object({
        cardTypeId: cardTypeIdSchema,
        label: z.string().min(1).max(180),
        modelName: modelNameSchema,
        defaultDeck: z.string().min(1).max(180),
        requiredFields: z.array(fieldNameSchema),
        optionalFields: z.array(fieldNameSchema),
        renderIntent: z.enum(['recognition', 'production', 'cloze', 'mixed']),
        allowedHtmlPolicy: z.enum(['plain_text_only', 'safe_inline_html', 'trusted_html']),
        fields: z.array(
          z
            .object({
              name: fieldNameSchema,
              required: z.boolean(),
              type: z.enum(['text', 'markdown', 'html', 'audio_ref', 'image_ref']),
              allowedHtmlPolicy: z.enum(['plain_text_only', 'safe_inline_html', 'trusted_html']),
              minLength: z.number().int().min(0).optional(),
              maxLength: z.number().int().min(0).optional(),
              multiline: z.boolean().optional(),
              example: z.string().optional(),
              hint: z.string().optional(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export const getCardTypeSchemaInputSchema = z
  .object({
    cardTypeId: cardTypeIdSchema,
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const createDraftInputSchema = z
  .object({
    cardTypeId: cardTypeIdSchema,
    profileId: profileIdSchema,
    clientRequestId: clientRequestIdSchema,
    fields: z.record(z.string(), z.string()),
    deckName: z.string().min(1).max(180).optional(),
    tags: z.array(z.string()).optional(),
    supersedesDraftId: draftIdSchema.optional(),
  })
  .strict();

export const createDraftsBatchInputSchema = z
  .object({
    profileId: profileIdSchema,
    items: z.array(
      z
        .object({
          itemId: itemIdSchema,
          clientRequestId: clientRequestIdSchema,
          cardTypeId: cardTypeIdSchema,
          fields: z.record(z.string(), z.string()),
          deckName: z.string().min(1).max(180).optional(),
          tags: z.array(z.string()).optional(),
          supersedesDraftId: draftIdSchema.optional(),
        })
        .strict(),
    ).min(1).max(100),
  })
  .strict();

export const getDraftInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const openDraftPreviewInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const commitDraftInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema,
    reviewDecision: reviewDecisionSchema,
  })
  .strict();

export const commitDraftsBatchInputSchema = z
  .object({
    profileId: profileIdSchema,
    items: z.array(
      z
        .object({
          itemId: itemIdSchema,
          draftId: draftIdSchema,
          reviewDecision: reviewDecisionSchema,
        })
        .strict(),
    ).min(1).max(100),
  })
  .strict();

export const discardDraftInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema,
    reason: z.enum(['user_request', 'cleanup', 'superseded', 'conflict_recovery']).optional(),
  })
  .strict();

export const discardDraftsBatchInputSchema = z
  .object({
    profileId: profileIdSchema,
    items: z.array(
      z
        .object({
          itemId: itemIdSchema,
          draftId: draftIdSchema,
          reason: z.enum(['user_request', 'cleanup', 'superseded', 'conflict_recovery']).optional(),
        })
        .strict(),
    ).min(1).max(100),
  })
  .strict();

export const deprecateCardTypeDefinitionInputSchema = z
  .object({
    profileId: profileIdSchema,
    cardTypeId: cardTypeIdSchema,
  })
  .strict();

export const listDraftsInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
    states: z.array(draftStateSchema).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const cleanupDraftsInputSchema = z
  .object({
    profileId: profileIdSchema,
    olderThanHours: z.number().int().min(1).max(24 * 30).optional(),
    states: z.array(z.enum(['draft', 'superseded'])).optional(),
  })
  .strict();

export type ListCardTypesInput = z.infer<typeof listCardTypesInputSchema>;
export type ListCardTypeDefinitionsInput = z.infer<typeof listCardTypeDefinitionsInputSchema>;
export type ListNoteTypesInput = z.infer<typeof listNoteTypesInputSchema>;
export type GetNoteTypeSchemaInput = z.infer<typeof getNoteTypeSchemaInputSchema>;
export type UpsertNoteTypeInput = z.infer<typeof upsertNoteTypeInputSchema>;
export type UpsertCardTypeDefinitionInput = z.infer<typeof upsertCardTypeDefinitionInputSchema>;
export type GetCardTypeSchemaInput = z.infer<typeof getCardTypeSchemaInputSchema>;
export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;
export type CreateDraftsBatchInput = z.infer<typeof createDraftsBatchInputSchema>;
export type GetDraftInput = z.infer<typeof getDraftInputSchema>;
export type OpenDraftPreviewInput = z.infer<typeof openDraftPreviewInputSchema>;
export type CommitDraftInput = z.infer<typeof commitDraftInputSchema>;
export type CommitDraftsBatchInput = z.infer<typeof commitDraftsBatchInputSchema>;
export type DiscardDraftInput = z.infer<typeof discardDraftInputSchema>;
export type DiscardDraftsBatchInput = z.infer<typeof discardDraftsBatchInputSchema>;
export type DeprecateCardTypeDefinitionInput = z.infer<typeof deprecateCardTypeDefinitionInputSchema>;
export type ListDraftsInput = z.infer<typeof listDraftsInputSchema>;
export type CleanupDraftsInput = z.infer<typeof cleanupDraftsInputSchema>;
