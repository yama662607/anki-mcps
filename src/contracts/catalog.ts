import type { CardTypeDefinition } from './types.js';

export const CATALOG_VERSION = '2026-03-05.v1';

export const CARD_TYPES: CardTypeDefinition[] = [
  {
    cardTypeId: 'language.v1.basic-bilingual',
    label: 'Language Basic (Bilingual)',
    modelName: 'Basic',
    defaultDeck: 'Languages::Inbox',
    source: 'builtin',
    requiredFields: ['Front', 'Back'],
    optionalFields: ['Example'],
    renderIntent: 'recognition',
    allowedHtmlPolicy: 'safe_inline_html',
    fields: [
      {
        name: 'Front',
        required: true,
        type: 'text',
        allowedHtmlPolicy: 'safe_inline_html',
        minLength: 1,
        maxLength: 240,
        hint: 'Target word or phrase',
      },
      {
        name: 'Back',
        required: true,
        type: 'text',
        allowedHtmlPolicy: 'safe_inline_html',
        minLength: 1,
        maxLength: 1200,
        multiline: true,
        hint: 'Meaning and notes',
      },
      {
        name: 'Example',
        required: false,
        type: 'text',
        allowedHtmlPolicy: 'safe_inline_html',
        multiline: true,
      },
    ],
  },
  {
    cardTypeId: 'programming.v1.concept-qa',
    label: 'Programming Concept Q/A',
    modelName: 'Basic',
    defaultDeck: 'Programming::Concepts',
    source: 'builtin',
    requiredFields: ['Front', 'Back'],
    optionalFields: ['Code'],
    renderIntent: 'production',
    allowedHtmlPolicy: 'safe_inline_html',
    fields: [
      {
        name: 'Front',
        required: true,
        type: 'text',
        allowedHtmlPolicy: 'safe_inline_html',
        minLength: 1,
        maxLength: 240,
        hint: 'Question prompt',
      },
      {
        name: 'Back',
        required: true,
        type: 'markdown',
        allowedHtmlPolicy: 'safe_inline_html',
        minLength: 1,
        multiline: true,
        hint: 'Canonical explanation',
      },
      {
        name: 'Code',
        required: false,
        type: 'markdown',
        allowedHtmlPolicy: 'trusted_html',
        multiline: true,
      },
    ],
  },
  {
    cardTypeId: 'fundamentals.v1.cloze-facts',
    label: 'Fundamentals Cloze Facts',
    modelName: 'Cloze',
    defaultDeck: 'Fundamentals::Core',
    source: 'builtin',
    requiredFields: ['Text'],
    optionalFields: ['Extra'],
    renderIntent: 'cloze',
    allowedHtmlPolicy: 'trusted_html',
    fields: [
      {
        name: 'Text',
        required: true,
        type: 'html',
        allowedHtmlPolicy: 'trusted_html',
        minLength: 1,
        multiline: true,
        hint: 'Use cloze markers like {{c1::fact}}',
      },
      {
        name: 'Extra',
        required: false,
        type: 'html',
        allowedHtmlPolicy: 'safe_inline_html',
        multiline: true,
      },
    ],
  },
];

export function findCardType(cardTypeId: string): CardTypeDefinition | undefined {
  return CARD_TYPES.find((cardType) => cardType.cardTypeId === cardTypeId);
}
