import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  cleanupStagedCardsInputSchema,
  commitStagedCardInputSchema,
  createStagedCardInputSchema,
  getCardTypeSchemaInputSchema,
  listCardTypesInputSchema,
  listStagedCardsInputSchema,
  openStagedCardPreviewInputSchema,
  validateCardFieldsInputSchema,
  discardStagedCardInputSchema,
} from '../contracts/schemas.js';
import { CatalogService } from '../services/catalogService.js';
import { DraftService } from '../services/draftService.js';
import { getContractsResourcePayload } from './contractsResource.js';
import { errorResult, parseOrThrow, successResult } from './result.js';
import { resolveProfileId } from '../utils/profile.js';

export function registerMcpHandlers(server: McpServer, services: {
  catalogService: CatalogService;
  draftService: DraftService;
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
          ...services.catalogService.listCardTypes(),
        };
        return successResult(payload);
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
          ...services.catalogService.getCardTypeSchema(args.cardTypeId),
        };
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'validate_card_fields',
    {
      title: 'Validate Card Fields',
      description: 'Validate and sanitize card field inputs before creation.',
      inputSchema: validateCardFieldsInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(validateCardFieldsInputSchema, input);
        const profileId = resolveProfileId({
          providedProfileId: args.profileId,
          activeProfileId: process.env.ANKI_ACTIVE_PROFILE,
          requireExplicitForWrite: false,
        });
        const payload = {
          contractVersion: '1.0.0',
          profileId,
          ...services.catalogService.validateFields(args),
        };
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'create_staged_card',
    {
      title: 'Create Staged Card',
      description: 'Create a staged card draft with idempotency and isolation.',
      inputSchema: createStagedCardInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(createStagedCardInputSchema, input);
        const payload = await services.draftService.createStagedCard(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'open_staged_card_preview',
    {
      title: 'Open Staged Card Preview',
      description: 'Open Anki Browser for staged card preview.',
      inputSchema: openStagedCardPreviewInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(openStagedCardPreviewInputSchema, input);
        const payload = await services.draftService.openStagedCardPreview(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'commit_staged_card',
    {
      title: 'Commit Staged Card',
      description: 'Commit a staged draft after explicit review decision.',
      inputSchema: commitStagedCardInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(commitStagedCardInputSchema, input);
        const payload = await services.draftService.commitStagedCard(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'discard_staged_card',
    {
      title: 'Discard Staged Card',
      description: 'Discard staged/superseded draft and remove Anki note.',
      inputSchema: discardStagedCardInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(discardStagedCardInputSchema, input);
        const payload = await services.draftService.discardStagedCard(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'list_staged_cards',
    {
      title: 'List Staged Cards',
      description: 'List staged lifecycle records with cursor pagination.',
      inputSchema: listStagedCardsInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(listStagedCardsInputSchema, input);
        const payload = services.draftService.listStagedCards(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'cleanup_staged_cards',
    {
      title: 'Cleanup Staged Cards',
      description: 'Discard stale staged/superseded drafts older than threshold.',
      inputSchema: cleanupStagedCardsInputSchema,
    },
    async (input) => {
      try {
        const args = parseOrThrow(cleanupStagedCardsInputSchema, input);
        const payload = await services.draftService.cleanupStagedCards(args);
        return successResult(payload);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
