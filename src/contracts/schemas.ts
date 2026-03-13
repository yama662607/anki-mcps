import { z } from "zod";

export const contractVersion = "1.0.0" as const;

export const profileIdSchema = z.string().min(1).max(120);
export const modelNameSchema = z.string().min(1).max(180);
export const fieldNameSchema = z.string().min(1).max(180);
export const templateNameSchema = z.string().min(1).max(180);
export const deckNameSchema = z.string().min(1).max(180);
export const noteIdSchema = z.number().int().positive();
export const cardIdSchema = z.number().int().positive();
export const itemIdSchema = z.string().min(1).max(120);
export const clientRequestIdSchema = z.string().min(1).max(120);

export const fieldsInputSchema = z.record(fieldNameSchema, z.string());
export const tagsInputSchema = z.array(z.string().min(1).max(180)).max(128);

export const listNoteTypesInputSchema = z
  .object({ profileId: profileIdSchema.optional() })
  .strict();

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

export const listDecksInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const getRuntimeStatusInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
  })
  .strict();

export const searchNotesInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
    query: z.string().max(500).optional(),
    modelNames: z.array(modelNameSchema).min(1).max(32).optional(),
    deckNames: z.array(deckNameSchema).min(1).max(32).optional(),
    tags: z.array(z.string().min(1).max(180)).min(1).max(32).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const getNotesInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
    noteIds: z.array(noteIdSchema).min(1).max(100),
  })
  .strict();

export const ensureDeckInputSchema = z
  .object({
    profileId: profileIdSchema,
    deckName: deckNameSchema,
  })
  .strict();

export const addNoteInputSchema = z
  .object({
    profileId: profileIdSchema,
    clientRequestId: clientRequestIdSchema.optional(),
    deckName: deckNameSchema,
    modelName: modelNameSchema,
    fields: fieldsInputSchema,
    tags: tagsInputSchema.optional(),
    suspendNewCards: z.boolean().optional(),
  })
  .strict();

export const addNotesBatchInputSchema = z
  .object({
    profileId: profileIdSchema,
    items: z
      .array(
        z
          .object({
            itemId: itemIdSchema,
            clientRequestId: clientRequestIdSchema.optional(),
            deckName: deckNameSchema,
            modelName: modelNameSchema,
            fields: fieldsInputSchema,
            tags: tagsInputSchema.optional(),
            suspendNewCards: z.boolean().optional(),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();

export const updateNoteInputSchema = z
  .object({
    profileId: profileIdSchema,
    noteId: noteIdSchema,
    expectedModTimestamp: z.number().int().nonnegative(),
    fields: fieldsInputSchema.optional(),
    tags: tagsInputSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.fields && !value.tags) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either fields or tags must be provided",
        path: ["fields"],
      });
    }
  });

export const deleteNoteInputSchema = z
  .object({
    profileId: profileIdSchema,
    noteId: noteIdSchema,
  })
  .strict();

export const deleteNotesBatchInputSchema = z
  .object({
    profileId: profileIdSchema,
    items: z
      .array(
        z
          .object({
            itemId: itemIdSchema,
            noteId: noteIdSchema,
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();

export const openNotePreviewInputSchema = z
  .object({
    profileId: profileIdSchema.optional(),
    noteId: noteIdSchema,
  })
  .strict();

export const setNoteCardsSuspendedInputSchema = z
  .object({
    profileId: profileIdSchema,
    noteId: noteIdSchema,
    suspended: z.boolean(),
  })
  .strict();

export const importMediaAssetInputSchema = z
  .object({
    profileId: profileIdSchema,
    localPath: z.string().min(1),
    mediaKind: z.enum(["audio", "image"]).optional(),
    preferredFilename: z.string().min(1).max(180).optional(),
  })
  .strict();

export type ListNoteTypesInput = z.infer<typeof listNoteTypesInputSchema>;
export type GetNoteTypeSchemaInput = z.infer<typeof getNoteTypeSchemaInputSchema>;
export type UpsertNoteTypeInput = z.infer<typeof upsertNoteTypeInputSchema>;
export type ListDecksInput = z.infer<typeof listDecksInputSchema>;
export type GetRuntimeStatusInput = z.infer<typeof getRuntimeStatusInputSchema>;
export type SearchNotesInput = z.infer<typeof searchNotesInputSchema>;
export type GetNotesInput = z.infer<typeof getNotesInputSchema>;
export type EnsureDeckInput = z.infer<typeof ensureDeckInputSchema>;
export type AddNoteInput = z.infer<typeof addNoteInputSchema>;
export type AddNotesBatchInput = z.infer<typeof addNotesBatchInputSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteInputSchema>;
export type DeleteNotesBatchInput = z.infer<typeof deleteNotesBatchInputSchema>;
export type OpenNotePreviewInput = z.infer<typeof openNotePreviewInputSchema>;
export type SetNoteCardsSuspendedInput = z.infer<typeof setNoteCardsSuspendedInputSchema>;
export type ImportMediaAssetInput = z.infer<typeof importMediaAssetInputSchema>;
