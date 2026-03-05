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
      required: ['cardTypeId', 'label', 'modelName', 'defaultDeck', 'requiredFields', 'renderIntent', 'allowedHtmlPolicy'],
      additionalProperties: false,
      properties: {
        cardTypeId: { type: 'string' },
        label: { type: 'string' },
        modelName: { type: 'string' },
        defaultDeck: { type: 'string' },
        requiredFields: { type: 'array', items: { type: 'string' } },
        renderIntent: { enum: ['recognition', 'production', 'cloze', 'mixed'] },
        allowedHtmlPolicy: { enum: ['plain_text_only', 'safe_inline_html', 'trusted_html'] },
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
        'stagedMarkerTag',
        'createdAt',
        'updatedAt',
      ],
      additionalProperties: false,
      properties: {
        draftId: { type: 'string' },
        profileId: { type: 'string' },
        noteId: { type: 'number' },
        cardIds: { type: 'array', items: { type: 'number' } },
        state: { enum: ['staged', 'superseded', 'committed', 'discarded'] },
        cardTypeId: { type: 'string' },
        fingerprint: { type: 'string' },
        supersedesDraftId: { type: 'string' },
        chainDepth: { type: 'number' },
        fields: { type: 'object', additionalProperties: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        deckName: { type: 'string' },
        modTimestamp: { type: 'number' },
        clientRequestId: { type: 'string' },
        stagedMarkerTag: { type: 'string' },
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
        state: { enum: ['staged', 'superseded', 'committed', 'discarded'] },
        cardTypeId: { type: 'string' },
        supersedesDraftId: { type: 'string' },
        chainDepth: { type: 'number' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
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
    validate_card_fields: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['cardTypeId', 'fields'],
        properties: {
          cardTypeId: { type: 'string' },
          profileId: { type: 'string' },
          fields: { type: 'object', additionalProperties: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          deckName: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'valid', 'normalized', 'sanitization', 'errors', 'warnings'],
        properties: {
          ...baseResponse.properties,
          valid: { type: 'boolean' },
          normalized: { type: 'object' },
          sanitization: { type: 'object' },
          errors: { type: 'array', items: { $ref: '#/sharedTypes/ValidationIssue' } },
          warnings: { type: 'array', items: { $ref: '#/sharedTypes/ValidationIssue' } },
        },
      },
    },
    create_staged_card: {
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
    open_staged_card_preview: {
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
    commit_staged_card: {
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
    discard_staged_card: {
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
    list_staged_cards: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          states: { type: 'array', items: { enum: ['staged', 'superseded', 'committed', 'discarded'] } },
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
    cleanup_staged_cards: {
      request: {
        type: 'object',
        additionalProperties: false,
        required: ['profileId'],
        properties: {
          profileId: { type: 'string' },
          olderThanHours: { type: 'number' },
          states: { type: 'array', items: { enum: ['staged', 'superseded'] } },
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
