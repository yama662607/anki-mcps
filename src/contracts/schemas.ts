import { z } from 'zod';

export const contractVersion = '1.0.0' as const;

export const profileIdSchema = z.string().min(1).max(120);
export const cardTypeIdSchema = z.string().min(1).max(120);
export const draftIdSchema = z.string().min(1).max(120);
export const clientRequestIdSchema = z.string().min(1).max(120);

export const draftStateSchema = z.enum(['staged', 'superseded', 'committed', 'discarded']);

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

export const getCardTypeSchemaInputSchema = z
  .object({
    cardTypeId: cardTypeIdSchema,
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const validateCardFieldsInputSchema = z
  .object({
    cardTypeId: cardTypeIdSchema,
    profileId: profileIdSchema.optional(),
    fields: z.record(z.string(), z.string()),
    tags: z.array(z.string()).optional(),
    deckName: z.string().min(1).max(180).optional(),
  })
  .strict();

export const createStagedCardInputSchema = z
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

export const openStagedCardPreviewInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const commitStagedCardInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema,
    reviewDecision: reviewDecisionSchema,
  })
  .strict();

export const discardStagedCardInputSchema = z
  .object({
    draftId: draftIdSchema,
    profileId: profileIdSchema,
    reason: z.enum(['user_request', 'cleanup', 'superseded', 'conflict_recovery']).optional(),
  })
  .strict();

export const listStagedCardsInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
    states: z.array(draftStateSchema).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    cursor: z.string().optional(),
  })
  .strict();

export const cleanupStagedCardsInputSchema = z
  .object({
    profileId: profileIdSchema,
    olderThanHours: z.number().int().min(1).max(24 * 30).optional(),
    states: z.array(z.enum(['staged', 'superseded'])).optional(),
  })
  .strict();

export type ListCardTypesInput = z.infer<typeof listCardTypesInputSchema>;
export type GetCardTypeSchemaInput = z.infer<typeof getCardTypeSchemaInputSchema>;
export type ValidateCardFieldsInput = z.infer<typeof validateCardFieldsInputSchema>;
export type CreateStagedCardInput = z.infer<typeof createStagedCardInputSchema>;
export type OpenStagedCardPreviewInput = z.infer<typeof openStagedCardPreviewInputSchema>;
export type CommitStagedCardInput = z.infer<typeof commitStagedCardInputSchema>;
export type DiscardStagedCardInput = z.infer<typeof discardStagedCardInputSchema>;
export type ListStagedCardsInput = z.infer<typeof listStagedCardsInputSchema>;
export type CleanupStagedCardsInput = z.infer<typeof cleanupStagedCardsInputSchema>;
