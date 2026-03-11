import { ERROR_CODES } from './errors.js';

const baseResponse = {
  type: 'object',
  required: ['contractVersion', 'profileId'],
  additionalProperties: false,
  properties: {
    contractVersion: { type: 'string', const: '1.0.0' },
    profileId: { type: 'string' },
  },
} as const;

export const TOOL_CONTRACTS_V1 = {
  contractVersion: '1.0.0',
  uri: 'anki://contracts/v1/tools',
  errorRegistry: {
    codes: ERROR_CODES,
  },
  sharedTypes: {
    CardTypeSummary: {
      type: 'object',
      required: ['cardTypeId', 'label', 'modelName', 'defaultDeck', 'requiredFields', 'renderIntent', 'allowedHtmlPolicy', 'source'],
      additionalProperties: false,
      properties: {
        cardTypeId: { type: 'string' },
        label: { type: 'string' },
        modelName: { type: 'string' },
        defaultDeck: { type: 'string' },
        requiredFields: { type: 'array', items: { type: 'string' } },
        renderIntent: { enum: ['recognition', 'production', 'cloze', 'mixed'] },
        allowedHtmlPolicy: { enum: ['plain_text_only', 'safe_inline_html', 'trusted_html'] },
        source: { enum: ['builtin', 'custom'] },
      },
    },
    CustomCardTypeDefinition: {
      type: 'object',
      required: [
        'cardTypeId',
        'label',
        'modelName',
        'defaultDeck',
        'requiredFields',
        'optionalFields',
        'renderIntent',
        'allowedHtmlPolicy',
        'fields',
        'source',
        'profileId',
        'status',
        'updatedAt',
      ],
      additionalProperties: false,
      properties: {
        cardTypeId: { type: 'string' },
        label: { type: 'string' },
        modelName: { type: 'string' },
        defaultDeck: { type: 'string' },
        requiredFields: { type: 'array', items: { type: 'string' } },
        optionalFields: { type: 'array', items: { type: 'string' } },
        renderIntent: { enum: ['recognition', 'production', 'cloze', 'mixed'] },
        allowedHtmlPolicy: { enum: ['plain_text_only', 'safe_inline_html', 'trusted_html'] },
        fields: { type: 'array', items: { $ref: '#/sharedTypes/FieldSchema' } },
        source: { const: 'custom' },
        profileId: { type: 'string' },
        status: { enum: ['active', 'deprecated'] },
        updatedAt: { type: 'string' },
        deprecatedAt: { type: 'string' },
      },
    },
    FieldSchema: {
      type: 'object',
      required: ['name', 'required', 'type', 'allowedHtmlPolicy'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        required: { type: 'boolean' },
        type: { enum: ['text', 'markdown', 'html', 'audio_ref', 'image_ref'] },
        allowedHtmlPolicy: { enum: ['plain_text_only', 'safe_inline_html', 'trusted_html'] },
        minLength: { type: 'number' },
        maxLength: { type: 'number' },
        multiline: { type: 'boolean' },
        example: { type: 'string' },
        hint: { type: 'string' },
      },
    },
    ValidationIssue: {
      type: 'object',
      required: ['code', 'message'],
      additionalProperties: false,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        field: { type: 'string' },
        hint: { type: 'string' },
      },
    },
    DraftRecord: {
      type: 'object',
      required: [
        'draftId',
        'profileId',
        'noteId',
        'cardIds',
        'state',
        'cardTypeId',
        'fingerprint',
        'chainDepth',
        'fields',
        'tags',
        'deckName',
        'modTimestamp',
        'clientRequestId',
        'draftMarkerTag',
        'createdAt',
        'updatedAt',
      ],
      additionalProperties: false,
      properties: {
        draftId: { type: 'string' },
        profileId: { type: 'string' },
        noteId: { type: 'number' },
        cardIds: { type: 'array', items: { type: 'number' } },
        state: { enum: ['draft', 'superseded', 'committed', 'discarded'] },
        cardTypeId: { type: 'string' },
        fingerprint: { type: 'string' },
        supersedesDraftId: { type: 'string' },
        chainDepth: { type: 'number' },
        fields: { type: 'object', additionalProperties: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        deckName: { type: 'string' },
        modTimestamp: { type: 'number' },
        clientRequestId: { type: 'string' },
        draftMarkerTag: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        committedAt: { type: 'string' },
        discardedAt: { type: 'string' },
      },
    },
    DraftListItem: {
      type: 'object',
      required: ['draftId', 'noteId', 'state', 'cardTypeId', 'chainDepth', 'createdAt', 'updatedAt'],
      additionalProperties: false,
      properties: {
        draftId: { type: 'string' },
        noteId: { type: 'number' },
        state: { enum: ['draft', 'superseded', 'committed', 'discarded'] },
        cardTypeId: { type: 'string' },
        supersedesDraftId: { type: 'string' },
        chainDepth: { type: 'number' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
    NoteTypeSummary: {
      type: 'object',
      required: ['modelName', 'fieldNames', 'templateNames', 'isCloze'],
      additionalProperties: false,
      properties: {
        modelName: { type: 'string' },
        fieldNames: { type: 'array', items: { type: 'string' } },
        templateNames: { type: 'array', items: { type: 'string' } },
        isCloze: { type: 'boolean' },
      },
    },
    NoteTypeSchema: {
      type: 'object',
      required: ['modelName', 'fields', 'templates', 'css', 'fieldsOnTemplates', 'isCloze'],
      additionalProperties: false,
      properties: {
        modelName: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name'],
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        templates: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'front', 'back'],
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              front: { type: 'string' },
              back: { type: 'string' },
            },
          },
        },
        css: { type: 'string' },
        fieldsOnTemplates: { type: 'object' },
        isCloze: { type: 'boolean' },
      },
    },
  },
  tools: {
    list_card_types: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'catalogVersion', 'cardTypes'],
        properties: {
          ...baseResponse.properties,
          catalogVersion: { type: 'string' },
          cardTypes: { type: 'array', items: { $ref: '#/sharedTypes/CardTypeSummary' } },
        },
      },
    },
    list_note_types: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'noteTypes'],
        properties: {
          ...baseResponse.properties,
          noteTypes: { type: 'array', items: { $ref: '#/sharedTypes/NoteTypeSummary' } },
        },
      },
    },
    get_note_type_schema: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['modelName'],
        properties: {
          modelName: { type: 'string' },
          profileId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'noteType'],
        properties: {
          ...baseResponse.properties,
          noteType: { $ref: '#/sharedTypes/NoteTypeSchema' },
        },
      },
    },
    upsert_note_type: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId', 'modelName', 'fields', 'templates'],
        properties: {
          profileId: { type: 'string' },
          modelName: { type: 'string' },
          fields: { type: 'array' },
          templates: { type: 'array' },
          css: { type: 'string' },
          isCloze: { type: 'boolean' },
          dryRun: { type: 'boolean' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'dryRun', 'result'],
        properties: {
          ...baseResponse.properties,
          dryRun: { type: 'boolean' },
          result: { type: 'object' },
        },
      },
    },
    upsert_card_type_definition: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId', 'definition'],
        properties: {
          profileId: { type: 'string' },
          definition: { type: 'object' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'cardType'],
        properties: {
          ...baseResponse.properties,
          cardType: { type: 'object' },
        },
      },
    },
    list_card_type_definitions: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          includeDeprecated: { type: 'boolean' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'items'],
        properties: {
          ...baseResponse.properties,
          items: { type: 'array', items: { $ref: '#/sharedTypes/CustomCardTypeDefinition' } },
        },
      },
    },
    deprecate_card_type_definition: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId', 'cardTypeId'],
        properties: {
          profileId: { type: 'string' },
          cardTypeId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'cardType'],
        properties: {
          ...baseResponse.properties,
          cardType: { $ref: '#/sharedTypes/CustomCardTypeDefinition' },
        },
      },
    },
    get_card_type_schema: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['cardTypeId'],
        properties: {
          cardTypeId: { type: 'string' },
          profileId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'catalogVersion', 'cardType', 'fields'],
        properties: {
          ...baseResponse.properties,
          catalogVersion: { type: 'string' },
          cardType: { $ref: '#/sharedTypes/CardTypeSummary' },
          fields: { type: 'array', items: { $ref: '#/sharedTypes/FieldSchema' } },
        },
      },
    },
    create_draft: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['cardTypeId', 'profileId', 'clientRequestId', 'fields'],
        properties: {
          cardTypeId: { type: 'string' },
          profileId: { type: 'string' },
          clientRequestId: { type: 'string' },
          fields: { type: 'object', additionalProperties: { type: 'string' } },
          deckName: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          supersedesDraftId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'draft'],
        properties: {
          ...baseResponse.properties,
          draft: { $ref: '#/sharedTypes/DraftRecord' },
        },
      },
    },
    create_drafts_batch: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId', 'items'],
        properties: {
          profileId: { type: 'string' },
          items: { type: 'array' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'summary', 'results'],
        properties: {
          ...baseResponse.properties,
          summary: {
            type: 'object',
            required: ['succeeded', 'failed'],
            additionalProperties: false,
            properties: {
              succeeded: { type: 'number' },
              failed: { type: 'number' },
            },
          },
          results: { type: 'array' },
        },
      },
    },
    get_draft: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['draftId'],
        properties: {
          draftId: { type: 'string' },
          profileId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'draft', 'cardType'],
        properties: {
          ...baseResponse.properties,
          draft: { $ref: '#/sharedTypes/DraftRecord' },
          cardType: { $ref: '#/sharedTypes/CardTypeSummary' },
        },
      },
    },
    open_draft_preview: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['draftId'],
        properties: {
          draftId: { type: 'string' },
          profileId: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'draftId', 'preview'],
        properties: {
          ...baseResponse.properties,
          draftId: { type: 'string' },
          preview: { type: 'object' },
        },
      },
    },
    commit_draft: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['draftId', 'profileId', 'reviewDecision'],
        properties: {
          draftId: { type: 'string' },
          profileId: { type: 'string' },
          reviewDecision: { type: 'object' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'result'],
        properties: {
          ...baseResponse.properties,
          result: { type: 'object' },
        },
      },
    },
    commit_drafts_batch: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId', 'items'],
        properties: {
          profileId: { type: 'string' },
          items: { type: 'array' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'summary', 'results'],
        properties: {
          ...baseResponse.properties,
          summary: {
            type: 'object',
            required: ['succeeded', 'failed'],
            additionalProperties: false,
            properties: {
              succeeded: { type: 'number' },
              failed: { type: 'number' },
            },
          },
          results: { type: 'array' },
        },
      },
    },
    discard_draft: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['draftId', 'profileId'],
        properties: {
          draftId: { type: 'string' },
          profileId: { type: 'string' },
          reason: { enum: ['user_request', 'cleanup', 'superseded', 'conflict_recovery'] },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'result'],
        properties: {
          ...baseResponse.properties,
          result: { type: 'object' },
        },
      },
    },
    discard_drafts_batch: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId', 'items'],
        properties: {
          profileId: { type: 'string' },
          items: { type: 'array' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'summary', 'results'],
        properties: {
          ...baseResponse.properties,
          summary: {
            type: 'object',
            required: ['succeeded', 'failed'],
            additionalProperties: false,
            properties: {
              succeeded: { type: 'number' },
              failed: { type: 'number' },
            },
          },
          results: { type: 'array' },
        },
      },
    },
    list_drafts: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          states: { type: 'array', items: { enum: ['draft', 'superseded', 'committed', 'discarded'] } },
          limit: { type: 'number' },
          cursor: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'items'],
        properties: {
          ...baseResponse.properties,
          items: { type: 'array', items: { $ref: '#/sharedTypes/DraftListItem' } },
          nextCursor: { type: 'string' },
        },
      },
    },
    cleanup_drafts: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId'],
        properties: {
          profileId: { type: 'string' },
          olderThanHours: { type: 'number' },
          states: { type: 'array', items: { enum: ['draft', 'superseded'] } },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'olderThanHours', 'deletedCount', 'deletedDraftIds', 'executedAt'],
        properties: {
          ...baseResponse.properties,
          olderThanHours: { type: 'number' },
          deletedCount: { type: 'number' },
          deletedDraftIds: { type: 'array', items: { type: 'string' } },
          executedAt: { type: 'string' },
        },
      },
    },
  },
} as const;
