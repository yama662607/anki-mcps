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
    DeckSummary: {
      type: 'object',
      required: ['deckName'],
      additionalProperties: false,
      properties: {
        deckName: { type: 'string' },
      },
    },
    RuntimeStatus: {
      type: 'object',
      required: [
        'ready',
        'gatewayMode',
        'ankiConnectReachable',
        'extensionInstalled',
        'previewMode',
        'guidance',
      ],
      additionalProperties: false,
      properties: {
        ready: { type: 'boolean' },
        gatewayMode: { enum: ['anki-connect', 'memory'] },
        endpoint: { type: 'string' },
        ankiConnectReachable: { type: 'boolean' },
        extensionInstalled: { type: 'boolean' },
        previewMode: { enum: ['extension-preview', 'edit-dialog-fallback', 'memory', 'unavailable'] },
        guidance: { type: 'array', items: { type: 'string' } },
      },
    },
    NoteSummary: {
      type: 'object',
      required: ['noteId', 'modelName', 'deckName', 'tags', 'cardIds', 'modTimestamp'],
      additionalProperties: false,
      properties: {
        noteId: { type: 'number' },
        modelName: { type: 'string' },
        deckName: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        cardIds: { type: 'array', items: { type: 'number' } },
        modTimestamp: { type: 'number' },
      },
    },
    NoteRecord: {
      allOf: [
        { $ref: '#/sharedTypes/NoteSummary' },
        {
          type: 'object',
          required: ['fields'],
          additionalProperties: false,
          properties: {
            fields: { type: 'object', additionalProperties: { type: 'string' } },
          },
        },
      ],
    },
    NoteReadResult: {
      type: 'object',
      required: ['noteId', 'ok'],
      additionalProperties: false,
      properties: {
        noteId: { type: 'number' },
        ok: { type: 'boolean' },
        note: { $ref: '#/sharedTypes/NoteRecord' },
        error: {
          type: 'object',
          required: ['code', 'message', 'retryable'],
          additionalProperties: false,
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            retryable: { type: 'boolean' },
            hint: { type: 'string' },
            context: { type: 'object' },
          },
        },
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
    NoteTypeValidationIssue: {
      type: 'object',
      required: ['code', 'message'],
      additionalProperties: false,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        location: {
          type: 'object',
          additionalProperties: false,
          properties: {
            templateName: { type: 'string' },
            side: { enum: ['front', 'back', 'css', 'note_type'] },
            fieldName: { type: 'string' },
          },
        },
      },
    },
    NoteTypeValidation: {
      type: 'object',
      required: ['canApply', 'errors', 'warnings'],
      additionalProperties: false,
      properties: {
        canApply: { type: 'boolean' },
        errors: { type: 'array', items: { $ref: '#/sharedTypes/NoteTypeValidationIssue' } },
        warnings: { type: 'array', items: { $ref: '#/sharedTypes/NoteTypeValidationIssue' } },
      },
    },
    BatchSummary: {
      type: 'object',
      required: ['succeeded', 'failed'],
      additionalProperties: false,
      properties: {
        succeeded: { type: 'number' },
        failed: { type: 'number' },
      },
    },
    MediaAsset: {
      type: 'object',
      required: ['mediaKind', 'sha256', 'storedFilename', 'fieldValue', 'alreadyExisted'],
      additionalProperties: false,
      properties: {
        mediaKind: { enum: ['audio', 'image'] },
        sha256: { type: 'string' },
        storedFilename: { type: 'string' },
        fieldValue: { type: 'string' },
        alreadyExisted: { type: 'boolean' },
      },
    },
  },
  tools: {
    get_runtime_status: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: { profileId: { type: 'string' } },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'runtime'],
        properties: {
          ...baseResponse.properties,
          runtime: { $ref: '#/sharedTypes/RuntimeStatus' },
        },
      },
    },
    list_decks: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: { profileId: { type: 'string' } },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'decks'],
        properties: {
          ...baseResponse.properties,
          decks: { type: 'array', items: { $ref: '#/sharedTypes/DeckSummary' } },
        },
      },
    },
    list_note_types: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: { profileId: { type: 'string' } },
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
        required: ['modelName'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          modelName: { type: 'string' },
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
    search_notes: {
      request: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          query: { type: 'string' },
          modelNames: { type: 'array', items: { type: 'string' } },
          deckNames: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'notes', 'query'],
        properties: {
          ...baseResponse.properties,
          query: { type: 'string' },
          notes: { type: 'array', items: { $ref: '#/sharedTypes/NoteSummary' } },
        },
      },
    },
    get_notes: {
      request: {
        type: 'object',
        required: ['noteIds'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          noteIds: { type: 'array', items: { type: 'number' } },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'results'],
        properties: {
          ...baseResponse.properties,
          results: { type: 'array', items: { $ref: '#/sharedTypes/NoteReadResult' } },
        },
      },
    },
    ensure_deck: {
      request: {
        type: 'object',
        required: ['profileId', 'deckName'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          deckName: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'deckName', 'created'],
        properties: {
          ...baseResponse.properties,
          deckName: { type: 'string' },
          created: { type: 'boolean' },
        },
      },
    },
    upsert_note_type: {
      request: {
        type: 'object',
        required: ['profileId', 'modelName', 'fields', 'templates'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          modelName: { type: 'string' },
          fields: { type: 'array', items: { type: 'object' } },
          templates: { type: 'array', items: { type: 'object' } },
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
          result: {
            type: 'object',
            required: ['status', 'operations', 'noteType', 'validation'],
            additionalProperties: false,
            properties: {
              status: { enum: ['planned', 'invalid', 'created', 'updated'] },
              operations: { type: 'array', items: { type: 'object' } },
              noteType: { $ref: '#/sharedTypes/NoteTypeSchema' },
              validation: { $ref: '#/sharedTypes/NoteTypeValidation' },
            },
          },
        },
      },
    },
    add_note: {
      request: {
        type: 'object',
        required: ['profileId', 'deckName', 'modelName', 'fields'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          clientRequestId: { type: 'string' },
          deckName: { type: 'string' },
          modelName: { type: 'string' },
          fields: { type: 'object', additionalProperties: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          suspendNewCards: { type: 'boolean' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'note', 'reviewPending'],
        properties: {
          ...baseResponse.properties,
          reviewPending: { type: 'boolean' },
          note: { $ref: '#/sharedTypes/NoteRecord' },
          idempotentReplay: { type: 'boolean' },
        },
      },
    },
    add_notes_batch: {
      request: {
        type: 'object',
        required: ['profileId', 'items'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'summary', 'results'],
        properties: {
          ...baseResponse.properties,
          summary: { $ref: '#/sharedTypes/BatchSummary' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              required: ['itemId', 'ok'],
              additionalProperties: false,
              properties: {
                itemId: { type: 'string' },
                ok: { type: 'boolean' },
                note: { $ref: '#/sharedTypes/NoteRecord' },
                reviewPending: { type: 'boolean' },
                error: {
                  type: 'object',
                  required: ['code', 'message', 'retryable'],
                  additionalProperties: false,
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    retryable: { type: 'boolean' },
                    hint: { type: 'string' },
                    context: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    update_note: {
      request: {
        type: 'object',
        required: ['profileId', 'noteId', 'expectedModTimestamp'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          noteId: { type: 'number' },
          expectedModTimestamp: { type: 'number' },
          fields: { type: 'object', additionalProperties: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'note'],
        properties: {
          ...baseResponse.properties,
          note: { $ref: '#/sharedTypes/NoteRecord' },
        },
      },
    },
    delete_note: {
      request: {
        type: 'object',
        required: ['profileId', 'noteId'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          noteId: { type: 'number' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'noteId', 'status'],
        properties: {
          ...baseResponse.properties,
          noteId: { type: 'number' },
          status: { enum: ['deleted', 'already_deleted'] },
        },
      },
    },
    delete_notes_batch: {
      request: {
        type: 'object',
        required: ['profileId', 'items'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'summary', 'results'],
        properties: {
          ...baseResponse.properties,
          summary: { $ref: '#/sharedTypes/BatchSummary' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              required: ['itemId', 'ok'],
              additionalProperties: false,
              properties: {
                itemId: { type: 'string' },
                ok: { type: 'boolean' },
                noteId: { type: 'number' },
                status: { enum: ['deleted', 'already_deleted'] },
                error: {
                  type: 'object',
                  required: ['code', 'message', 'retryable'],
                  additionalProperties: false,
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    retryable: { type: 'boolean' },
                    hint: { type: 'string' },
                    context: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    open_note_preview: {
      request: {
        type: 'object',
        required: ['noteId'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          noteId: { type: 'number' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'noteId', 'preview'],
        properties: {
          ...baseResponse.properties,
          noteId: { type: 'number' },
          preview: {
            type: 'object',
            required: ['opened', 'browserQuery', 'selectedCardIds'],
            additionalProperties: false,
            properties: {
              opened: { type: 'boolean' },
              browserQuery: { type: 'string' },
              selectedCardIds: { type: 'array', items: { type: 'number' } },
            },
          },
        },
      },
    },
    set_note_cards_suspended: {
      request: {
        type: 'object',
        required: ['profileId', 'noteId', 'suspended'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          noteId: { type: 'number' },
          suspended: { type: 'boolean' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'noteId', 'cardIds', 'suspended'],
        properties: {
          ...baseResponse.properties,
          noteId: { type: 'number' },
          cardIds: { type: 'array', items: { type: 'number' } },
          suspended: { type: 'boolean' },
        },
      },
    },
    import_media_asset: {
      request: {
        type: 'object',
        required: ['profileId', 'localPath'],
        additionalProperties: false,
        properties: {
          profileId: { type: 'string' },
          localPath: { type: 'string' },
          mediaKind: { enum: ['audio', 'image'] },
          preferredFilename: { type: 'string' },
        },
      },
      response: {
        ...baseResponse,
        required: [...baseResponse.required, 'asset'],
        properties: {
          ...baseResponse.properties,
          asset: { $ref: '#/sharedTypes/MediaAsset' },
        },
      },
    },
  },
} as const;
