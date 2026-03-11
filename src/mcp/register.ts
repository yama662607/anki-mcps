import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  cleanupDraftsInputSchema,
  commitDraftsBatchInputSchema,
  commitDraftInputSchema,
  createDraftsBatchInputSchema,
  createDraftInputSchema,
  deprecateCardTypeDefinitionInputSchema,
  getCardTypeSchemaInputSchema,
  getNoteTypeSchemaInputSchema,
  getDraftInputSchema,
  listCardTypeDefinitionsInputSchema,
  listCardTypesInputSchema,
  listNoteTypesInputSchema,
  listDraftsInputSchema,
  openDraftPreviewInputSchema,
  upsertCardTypeDefinitionInputSchema,
  upsertNoteTypeInputSchema,
  discardDraftsBatchInputSchema,
  discardDraftInputSchema,
} from '../contracts/schemas.js';
import { CatalogService } from '../services/catalogService.js';
import { DraftService } from '../services/draftService.js';
import { NoteTypeService } from '../services/noteTypeService.js';
import { getContractsResourcePayload } from './contractsResource.js';
import { errorResult, parseOrThrow, successResult } from './result.js';
import { resolveProfileId } from '../utils/profile.js';

export function registerMcpHandlers(server: McpServer, services: {
  catalogService: CatalogService;
  draftService: DraftService;
  noteTypeService: NoteTypeService;
}) {
  server.registerResource(
    'tool_contracts_v1',
    'anki://contracts/v1/tools',
    {
      title: 'Anki MCP v1 Tool Contracts',
      description: 'Frozen tool schemas and shared type registry for v1.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(getContractsResourcePayload(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'card_type_catalog',
    'anki://catalog/card-types',
    {
      title: 'Anki Card Type Catalog',
      description: 'Stable catalog definitions for card creation.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(services.draftService.getCatalogResourcePayload(), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    'list_card_types',
    {
      title: 'List Card Types',
      description: 'Return stable card type catalog entries.',
      inputSchema: listCardTypesInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(listCardTypesInputSchema, input);
        const profileId = resolveProfileId({
          providedProfileId: args.profileId,
          activeProfileId: process.env.ANKI_ACTIVE_PROFILE,
          requireExplicitForWrite: false,
        });
        const payload = {
          contractVersion: '1.0.0',
          profileId,
          ...services.catalogService.listCardTypes(profileId),
        };
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'list_card_type_definitions',
    {
      title: 'List Card Type Definitions',
      description: 'List profile-scoped custom card type definitions. Active only by default.',
      inputSchema: listCardTypeDefinitionsInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(listCardTypeDefinitionsInputSchema, input);
        const profileId = resolveProfileId({
          providedProfileId: args.profileId,
          activeProfileId: process.env.ANKI_ACTIVE_PROFILE,
          requireExplicitForWrite: false,
        });
        return successResult({
          contractVersion: '1.0.0',
          profileId,
          ...services.catalogService.listCardTypeDefinitions(profileId, {
            includeDeprecated: args.includeDeprecated,
          }),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'deprecate_card_type_definition',
    {
      title: 'Deprecate Card Type Definition',
      description: 'Mark a custom card type definition as deprecated without deleting it.',
      inputSchema: deprecateCardTypeDefinitionInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(deprecateCardTypeDefinitionInputSchema, input);
        const profileId = resolveProfileId({
          providedProfileId: args.profileId,
          activeProfileId: process.env.ANKI_ACTIVE_PROFILE,
          requireExplicitForWrite: true,
        });
        return successResult({
          contractVersion: '1.0.0',
          profileId,
          ...services.catalogService.deprecateCardTypeDefinition(profileId, args.cardTypeId),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'get_card_type_schema',
    {
      title: 'Get Card Type Schema',
      description: 'Read schema details for one card type.',
      inputSchema: getCardTypeSchemaInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(getCardTypeSchemaInputSchema, input);
        const profileId = resolveProfileId({
          providedProfileId: args.profileId,
          activeProfileId: process.env.ANKI_ACTIVE_PROFILE,
          requireExplicitForWrite: false,
        });
        const payload = {
          contractVersion: '1.0.0',
          profileId,
          ...services.catalogService.getCardTypeSchema(profileId, args.cardTypeId),
        };
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'list_note_types',
    {
      title: 'List Note Types',
      description: 'Return available Anki note types with field/template summaries.',
      inputSchema: listNoteTypesInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(listNoteTypesInputSchema, input);
        return successResult(await services.noteTypeService.listNoteTypes(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'get_note_type_schema',
    {
      title: 'Get Note Type Schema',
      description: 'Inspect fields, templates, CSS, and field bindings for one note type.',
      inputSchema: getNoteTypeSchemaInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(getNoteTypeSchemaInputSchema, input);
        return successResult(await services.noteTypeService.getNoteTypeSchema(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'upsert_note_type',
    {
      title: 'Upsert Note Type',
      description: 'Dry-run by default. Creates or updates a note type with additive-safe constraints.',
      inputSchema: upsertNoteTypeInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(upsertNoteTypeInputSchema, input);
        return successResult(await services.noteTypeService.upsertNoteType(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'upsert_card_type_definition',
    {
      title: 'Upsert Card Type Definition',
      description: 'Store a profile-scoped custom card type definition that maps onto an Anki note type.',
      inputSchema: upsertCardTypeDefinitionInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(upsertCardTypeDefinitionInputSchema, input);
        const profileId = resolveProfileId({
          providedProfileId: args.profileId,
          activeProfileId: process.env.ANKI_ACTIVE_PROFILE,
          requireExplicitForWrite: true,
        });
        const payload = {
          contractVersion: '1.0.0',
          profileId,
          cardType: services.catalogService.upsertCustomCardTypeDefinition(profileId, args.definition),
        };
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'create_draft',
    {
      title: 'Create Draft',
      description: 'Create a draft only (not committed). Requires profileId and clientRequestId.',
      inputSchema: createDraftInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(createDraftInputSchema, input);
        const payload = await services.draftService.createStagedCard(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'create_drafts_batch',
    {
      title: 'Create Drafts Batch',
      description: 'Create multiple drafts with per-item success and error reporting.',
      inputSchema: createDraftsBatchInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(createDraftsBatchInputSchema, input);
        return successResult(await services.draftService.createStagedCardsBatch(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'get_draft',
    {
      title: 'Get Draft',
      description: 'Read stored metadata and field contents for one draft.',
      inputSchema: getDraftInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(getDraftInputSchema, input);
        return successResult(await services.draftService.getStagedCard(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'open_draft_preview',
    {
      title: 'Open Draft Preview',
      description: 'Open Anki Browser for visual review of a draft before commit/discard.',
      inputSchema: openDraftPreviewInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(openDraftPreviewInputSchema, input);
        const payload = await services.draftService.openStagedCardPreview(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'commit_draft',
    {
      title: 'Commit Draft',
      description: 'Finalize a draft after explicit user approval and full reviewDecision=true checks.',
      inputSchema: commitDraftInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(commitDraftInputSchema, input);
        const payload = await services.draftService.commitStagedCard(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'commit_drafts_batch',
    {
      title: 'Commit Drafts Batch',
      description: 'Commit multiple drafts with per-item review decisions and outcomes.',
      inputSchema: commitDraftsBatchInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      try {
        const args = parseOrThrow(commitDraftsBatchInputSchema, input);
        return successResult(await services.draftService.commitStagedCardsBatch(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'discard_draft',
    {
      title: 'Discard Draft',
      description: 'Discard draft/superseded draft and remove the Anki note.',
      inputSchema: discardDraftInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(discardDraftInputSchema, input);
        const payload = await services.draftService.discardStagedCard(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'discard_drafts_batch',
    {
      title: 'Discard Drafts Batch',
      description: 'Discard multiple drafts with per-item success and idempotent already_discarded results.',
      inputSchema: discardDraftsBatchInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(discardDraftsBatchInputSchema, input);
        return successResult(await services.draftService.discardStagedCardsBatch(args));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'list_drafts',
    {
      title: 'List Drafts',
      description: 'List draft lifecycle records with cursor pagination.',
      inputSchema: listDraftsInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(listDraftsInputSchema, input);
        const payload = services.draftService.listStagedCards(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'cleanup_drafts',
    {
      title: 'Cleanup Drafts',
      description: 'Discard stale draft/superseded drafts older than threshold.',
      inputSchema: cleanupDraftsInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      try {
        const args = parseOrThrow(cleanupDraftsInputSchema, input);
        const payload = await services.draftService.cleanupStagedCards(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
