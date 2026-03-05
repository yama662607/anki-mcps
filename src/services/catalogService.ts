import { AppError } from '../contracts/errors.js';
import { CARD_TYPES, CATALOG_VERSION, findCardType } from '../contracts/catalog.js';
import type { CardTypeSummary, ValidationIssue } from '../contracts/types.js';
import { normalizeTags, sortRecord } from '../utils/canonical.js';
import { sanitizeByPolicy } from '../utils/sanitize.js';

export type ValidateFieldsInput = {
  cardTypeId: string;
  fields: Record<string, string>;
  tags?: string[];
  deckName?: string;
};

export type ValidateFieldsOutput = {
  valid: boolean;
  normalized: {
    fields: Record<string, string>;
    tags: string[];
    deckName: string;
  };
  sanitization: {
    policyByField: Record<string, 'plain_text_only' | 'safe_inline_html' | 'trusted_html'>;
    modifiedFields: string[];
  };
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export class CatalogService {
  listCardTypes(): { catalogVersion: string; cardTypes: CardTypeSummary[] } {
    return {
      catalogVersion: CATALOG_VERSION,
      cardTypes: CARD_TYPES.map((cardType) => ({
        cardTypeId: cardType.cardTypeId,
        label: cardType.label,
        modelName: cardType.modelName,
        defaultDeck: cardType.defaultDeck,
        requiredFields: cardType.requiredFields,
        renderIntent: cardType.renderIntent,
        allowedHtmlPolicy: cardType.allowedHtmlPolicy,
      })),
    };
  }

  getCardTypeSchema(cardTypeId: string) {
    const cardType = findCardType(cardTypeId);
    if (!cardType) {
      throw new AppError('NOT_FOUND', `Unknown cardTypeId: ${cardTypeId}`);
    }
    return {
      catalogVersion: CATALOG_VERSION,
      cardType: {
        cardTypeId: cardType.cardTypeId,
        label: cardType.label,
        modelName: cardType.modelName,
        defaultDeck: cardType.defaultDeck,
        requiredFields: cardType.requiredFields,
        renderIntent: cardType.renderIntent,
        allowedHtmlPolicy: cardType.allowedHtmlPolicy,
      },
      fields: cardType.fields,
    };
  }

  validateFields(input: ValidateFieldsInput): ValidateFieldsOutput {
    const cardType = findCardType(input.cardTypeId);
    if (!cardType) {
      throw new AppError('NOT_FOUND', `Unknown cardTypeId: ${input.cardTypeId}`);
    }

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    const knownFields = new Set(cardType.fields.map((field) => field.name));
    const providedFieldNames = Object.keys(input.fields);

    for (const requiredField of cardType.requiredFields) {
      if (!input.fields[requiredField] || input.fields[requiredField].trim().length === 0) {
        errors.push({
          code: 'REQUIRED_FIELD_MISSING',
          field: requiredField,
          message: `Required field is missing: ${requiredField}`,
        });
      }
    }

    for (const fieldName of providedFieldNames) {
      if (!knownFields.has(fieldName)) {
        errors.push({
          code: 'UNKNOWN_FIELD',
          field: fieldName,
          message: `Unknown field for card type: ${fieldName}`,
        });
      }
    }

    const normalizedFields: Record<string, string> = {};
    const policyByField: Record<string, 'plain_text_only' | 'safe_inline_html' | 'trusted_html'> = {};
    const modifiedFields: string[] = [];

    for (const schema of cardType.fields) {
      const raw = input.fields[schema.name] ?? '';
      const sanitized = sanitizeByPolicy(raw, schema.allowedHtmlPolicy);
      normalizedFields[schema.name] = sanitized.value;
      policyByField[schema.name] = schema.allowedHtmlPolicy;

      if (sanitized.modified) {
        modifiedFields.push(schema.name);
      }

      if (schema.minLength !== undefined && sanitized.value.length < schema.minLength && raw.trim().length > 0) {
        errors.push({
          code: 'FIELD_TOO_SHORT',
          field: schema.name,
          message: `Field ${schema.name} must be at least ${schema.minLength} characters`,
        });
      }

      if (schema.maxLength !== undefined && sanitized.value.length > schema.maxLength) {
        warnings.push({
          code: 'FIELD_TOO_LONG',
          field: schema.name,
          message: `Field ${schema.name} is long (${sanitized.value.length})`,
          hint: `Recommended maximum is ${schema.maxLength}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      normalized: {
        fields: sortRecord(normalizedFields),
        tags: normalizeTags(input.tags ?? []),
        deckName: input.deckName ?? cardType.defaultDeck,
      },
      sanitization: {
        policyByField,
        modifiedFields: modifiedFields.sort((a, b) => a.localeCompare(b)),
      },
      errors,
      warnings,
    };
  }
}
