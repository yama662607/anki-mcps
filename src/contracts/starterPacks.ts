import type {
  CardTypeDefinition,
  FieldSchema,
  NoteTypeField,
  NoteTypeTemplate,
  StarterPackManifest,
  StarterPackOptionValue,
  StarterPackSummary,
} from './types.js';

export const PACK_CATALOG_VERSION = '2026-03-11.v1';
export const SUPPORTED_PROGRAMMING_LANGUAGES = [
  'typescript',
  'python',
  'c',
  'cpp',
  'rust',
  'go',
  'java',
  'julia',
] as const;

export type ProgrammingLanguage = (typeof SUPPORTED_PROGRAMMING_LANGUAGES)[number];

type StarterPackOptions = {
  [key: string]: StarterPackOptionValue | undefined;
};

const sharedCardCss = `
.card { background: #0f172a; color: #e5eefc; font-family: "Avenir Next", "Hiragino Sans", sans-serif; }
.shell { padding: 22px; border-radius: 18px; border: 1px solid #22304a; background: linear-gradient(180deg, #111827 0%, #0b1220 100%); }
.badge { display: inline-block; margin-bottom: 14px; padding: 4px 10px; border-radius: 999px; font-size: 12px; letter-spacing: 0.04em; color: #9cc5ff; background: rgba(96, 165, 250, 0.14); }
.prompt, .question, .meaning, .expression, .task { font-size: 22px; line-height: 1.45; margin-bottom: 16px; }
.section { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.18); }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #7dd3fc; margin-bottom: 6px; }
.muted { color: #a5b4cc; }
.code-shell { margin-top: 14px; padding: 14px; border-radius: 14px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(148, 163, 184, 0.16); }
.code { white-space: pre-wrap; font-family: "SFMono-Regular", "Menlo", monospace; font-size: 14px; line-height: 1.6; }
.audio-line { margin-top: 10px; }
`;

function noteFields(names: string[]): NoteTypeField[] {
  return names.map((name) => ({ name }));
}

function conceptTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Concept</div><div class="prompt">{{Prompt}}</div></div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Answer</div><div>{{Answer}}</div></div>{{#DetailedExplanation}}<div class="section"><div class="label">Explanation</div><div>{{DetailedExplanation}}</div></div>{{/DetailedExplanation}}{{#Example}}<div class="section"><div class="label">Example</div><div>{{Example}}</div></div>{{/Example}}',
    },
  ];
}

function compareTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Compare</div><div class="prompt">{{Prompt}}</div><div class="section"><div><strong>{{ItemA}}</strong> vs <strong>{{ItemB}}</strong></div></div></div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Key difference</div><div>{{KeyDifference}}</div></div>{{#WhenToUse}}<div class="section"><div class="label">When to use</div><div>{{WhenToUse}}</div></div>{{/WhenToUse}}{{#Example}}<div class="section"><div class="label">Example</div><div>{{Example}}</div></div>{{/Example}}',
    },
  ];
}

function clozeTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Cloze',
      front: '<div class="shell"><div class="badge">Cloze</div><div class="prompt">{{cloze:Text}}</div></div>',
      back: '<div class="shell"><div class="badge">Cloze</div><div class="prompt">{{cloze:Text}}</div>{{#Extra}}<div class="section"><div class="label">Extra</div><div>{{Extra}}</div></div>{{/Extra}}</div>',
    },
  ];
}

function programmingOutputTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Output</div><div class="question">{{Question}}</div><div class="code-shell"><pre class="code">{{Code}}</pre></div></div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Expected</div><div>{{Expected}}</div></div>{{#Reason}}<div class="section"><div class="label">Reason</div><div>{{Reason}}</div></div>{{/Reason}}',
    },
  ];
}

function programmingDebugTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Debug</div><div class="code-shell"><pre class="code">{{BuggyCode}}</pre></div><div class="section"><div class="label">Symptom</div><div>{{Symptom}}</div></div></div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Fix</div><pre class="code">{{Fix}}</pre></div><div class="section"><div class="label">Root cause</div><div>{{RootCause}}</div></div><div class="section"><div class="label">Rule</div><div>{{Rule}}</div></div>',
    },
  ];
}

function programmingBuildTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Build</div><div class="task">{{Prompt}}</div><div class="code-shell"><pre class="code">{{Starter}}</pre></div></div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Expected</div><pre class="code">{{Expected}}</pre></div>{{#Explanation}}<div class="section"><div class="label">Explanation</div><div>{{Explanation}}</div></div>{{/Explanation}}{{#Rule}}<div class="section"><div class="label">Rule</div><div>{{Rule}}</div></div>{{/Rule}}',
    },
  ];
}

function vocabRecognitionTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Vocabulary</div><div class="expression">{{Expression}}</div>{{#Audio}}<div class="audio-line">{{Audio}}</div>{{/Audio}}</div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Meaning</div><div>{{Meaning}}</div></div>{{#Example}}<div class="section"><div class="label">Example</div><div>{{Example}}</div></div>{{/Example}}{{#Notes}}<div class="section"><div class="label">Notes</div><div>{{Notes}}</div></div>{{/Notes}}',
    },
  ];
}

function vocabProductionTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Production</div><div class="meaning">{{Meaning}}</div>{{#Notes}}<div class="section muted">{{Notes}}</div>{{/Notes}}</div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Expression</div><div>{{Expression}}</div></div>{{#Audio}}<div class="audio-line">{{Audio}}</div>{{/Audio}}{{#Example}}<div class="section"><div class="label">Example</div><div>{{Example}}</div></div>{{/Example}}',
    },
  ];
}

function listeningTemplate(): NoteTypeTemplate[] {
  return [
    {
      name: 'Card 1',
      front: '<div class="shell"><div class="badge">Listening</div><div class="task">{{Prompt}}</div><div class="audio-line">{{Audio}}</div></div>',
      back: '{{FrontSide}}<div class="section"><div class="label">Answer</div><div>{{Answer}}</div></div>{{#Transcript}}<div class="section"><div class="label">Transcript</div><div>{{Transcript}}</div></div>{{/Transcript}}{{#Notes}}<div class="section"><div class="label">Notes</div><div>{{Notes}}</div></div>{{/Notes}}',
    },
  ];
}

function field(
  name: string,
  required: boolean,
  type: FieldSchema['type'],
  allowedHtmlPolicy: FieldSchema['allowedHtmlPolicy'],
  extra: Partial<FieldSchema> = {},
): FieldSchema {
  return { name, required, type, allowedHtmlPolicy, ...extra };
}

function toTitleCase(value: string): string {
  const special: Record<string, string> = {
    typescript: 'TypeScript',
    cpp: 'Cpp',
  };
  if (special[value]) {
    return special[value];
  }
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function createEnglishManifest(options?: StarterPackOptions): StarterPackManifest {
  const deckRoot = typeof options?.deckRoot === 'string' ? options.deckRoot : 'Languages::English';
  return {
    packId: 'english-core',
    label: 'English Core',
    version: PACK_CATALOG_VERSION,
    domains: ['english', 'vocabulary', 'listening'],
    supportedOptions: [
      {
        name: 'deckRoot',
        type: 'string',
        required: false,
        description: 'Override the English deck root.',
        defaultValue: 'Languages::English',
      },
    ],
    deckRoots: [deckRoot],
    tagTemplates: {
      'language.v1.english-vocab-recognition': ['domain::english', 'skill::vocabulary', 'direction::recognition'],
      'language.v1.english-vocab-production': ['domain::english', 'skill::vocabulary', 'direction::production'],
      'language.v1.english-listening-comprehension': ['domain::english', 'skill::listening'],
    },
    noteTypes: [
      {
        modelName: 'language.v1.vocab-recognition',
        fields: noteFields(['Expression', 'Meaning', 'Example', 'Notes', 'Audio']),
        templates: vocabRecognitionTemplate(),
        css: sharedCardCss,
      },
      {
        modelName: 'language.v1.vocab-production',
        fields: noteFields(['Meaning', 'Expression', 'Example', 'Notes', 'Audio']),
        templates: vocabProductionTemplate(),
        css: sharedCardCss,
      },
      {
        modelName: 'language.v1.listening-comprehension',
        fields: noteFields(['Audio', 'Prompt', 'Answer', 'Transcript', 'Notes']),
        templates: listeningTemplate(),
        css: sharedCardCss,
      },
    ],
    cardTypes: [
      {
        cardTypeId: 'language.v1.english-vocab-recognition',
        label: 'English Vocabulary Recognition',
        modelName: 'language.v1.vocab-recognition',
        defaultDeck: `${deckRoot}::Vocabulary::Recognition`,
        source: 'custom',
        requiredFields: ['Expression', 'Meaning'],
        optionalFields: ['Example', 'Notes', 'Audio'],
        renderIntent: 'recognition',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          field('Expression', true, 'text', 'safe_inline_html'),
          field('Meaning', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Example', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Notes', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Audio', false, 'audio_ref', 'trusted_html'),
        ],
      },
      {
        cardTypeId: 'language.v1.english-vocab-production',
        label: 'English Vocabulary Production',
        modelName: 'language.v1.vocab-production',
        defaultDeck: `${deckRoot}::Vocabulary::Production`,
        source: 'custom',
        requiredFields: ['Meaning', 'Expression'],
        optionalFields: ['Example', 'Notes', 'Audio'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          field('Meaning', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Expression', true, 'text', 'safe_inline_html'),
          field('Example', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Notes', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Audio', false, 'audio_ref', 'trusted_html'),
        ],
      },
      {
        cardTypeId: 'language.v1.english-listening-comprehension',
        label: 'English Listening Comprehension',
        modelName: 'language.v1.listening-comprehension',
        defaultDeck: `${deckRoot}::Listening`,
        source: 'custom',
        requiredFields: ['Audio', 'Prompt', 'Answer'],
        optionalFields: ['Transcript', 'Notes'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'trusted_html',
        fields: [
          field('Audio', true, 'audio_ref', 'trusted_html'),
          field('Prompt', true, 'text', 'safe_inline_html'),
          field('Answer', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Transcript', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Notes', false, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
    ],
  };
}

function createProgrammingManifest(options?: StarterPackOptions): StarterPackManifest {
  const deckRoot = typeof options?.deckRoot === 'string' ? options.deckRoot : 'Programming';
  const languages = Array.isArray(options?.languages) && options.languages.length > 0
    ? options.languages
    : [...SUPPORTED_PROGRAMMING_LANGUAGES];

  const sharedNoteTypes = [
    {
      modelName: 'study.v1.concept',
      fields: noteFields(['Prompt', 'Answer', 'DetailedExplanation', 'Example']),
      templates: conceptTemplate(),
      css: sharedCardCss,
    },
    {
      modelName: 'study.v1.compare',
      fields: noteFields(['Prompt', 'ItemA', 'ItemB', 'KeyDifference', 'WhenToUse', 'Example']),
      templates: compareTemplate(),
      css: sharedCardCss,
    },
    {
      modelName: 'programming.v1.output',
      fields: noteFields(['Code', 'Question', 'Expected', 'Reason']),
      templates: programmingOutputTemplate(),
      css: sharedCardCss,
    },
    {
      modelName: 'programming.v1.debug',
      fields: noteFields(['BuggyCode', 'Symptom', 'Fix', 'RootCause', 'Rule']),
      templates: programmingDebugTemplate(),
      css: sharedCardCss,
    },
    {
      modelName: 'programming.v1.build',
      fields: noteFields(['Prompt', 'Starter', 'Expected', 'Explanation', 'Rule']),
      templates: programmingBuildTemplate(),
      css: sharedCardCss,
    },
  ];

  const cardTypes: CardTypeDefinition[] = [];
  const deckRoots = new Set<string>();

  for (const language of languages) {
    const label = toTitleCase(language);
    const languageRoot = `${deckRoot}::${label}`;
    deckRoots.add(languageRoot);

    cardTypes.push(
      {
        cardTypeId: `programming.v1.${language}-concept`,
        label: `${label} Concept`,
        modelName: 'study.v1.concept',
        defaultDeck: `${languageRoot}::Concept`,
        source: 'custom',
        requiredFields: ['Prompt', 'Answer'],
        optionalFields: ['DetailedExplanation', 'Example'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          field('Prompt', true, 'text', 'safe_inline_html'),
          field('Answer', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('DetailedExplanation', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Example', false, 'markdown', 'trusted_html', { multiline: true }),
        ],
      },
      {
        cardTypeId: `programming.v1.${language}-compare`,
        label: `${label} Compare`,
        modelName: 'study.v1.compare',
        defaultDeck: `${languageRoot}::Compare`,
        source: 'custom',
        requiredFields: ['Prompt', 'ItemA', 'ItemB', 'KeyDifference'],
        optionalFields: ['WhenToUse', 'Example'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          field('Prompt', true, 'text', 'safe_inline_html'),
          field('ItemA', true, 'text', 'safe_inline_html'),
          field('ItemB', true, 'text', 'safe_inline_html'),
          field('KeyDifference', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('WhenToUse', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Example', false, 'markdown', 'trusted_html', { multiline: true }),
        ],
      },
      {
        cardTypeId: `programming.v1.${language}-output`,
        label: `${label} Output`,
        modelName: 'programming.v1.output',
        defaultDeck: `${languageRoot}::Output`,
        source: 'custom',
        requiredFields: ['Code', 'Question', 'Expected'],
        optionalFields: ['Reason'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'trusted_html',
        fields: [
          field('Code', true, 'markdown', 'trusted_html', { multiline: true }),
          field('Question', true, 'text', 'safe_inline_html'),
          field('Expected', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Reason', false, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
      {
        cardTypeId: `programming.v1.${language}-debug`,
        label: `${label} Debug`,
        modelName: 'programming.v1.debug',
        defaultDeck: `${languageRoot}::Debug`,
        source: 'custom',
        requiredFields: ['BuggyCode', 'Symptom', 'Fix', 'RootCause', 'Rule'],
        optionalFields: [],
        renderIntent: 'production',
        allowedHtmlPolicy: 'trusted_html',
        fields: [
          field('BuggyCode', true, 'markdown', 'trusted_html', { multiline: true }),
          field('Symptom', true, 'text', 'safe_inline_html'),
          field('Fix', true, 'markdown', 'trusted_html', { multiline: true }),
          field('RootCause', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Rule', true, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
      {
        cardTypeId: `programming.v1.${language}-build`,
        label: `${label} Build`,
        modelName: 'programming.v1.build',
        defaultDeck: `${languageRoot}::Build`,
        source: 'custom',
        requiredFields: ['Prompt', 'Starter', 'Expected'],
        optionalFields: ['Explanation', 'Rule'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'trusted_html',
        fields: [
          field('Prompt', true, 'text', 'safe_inline_html'),
          field('Starter', true, 'markdown', 'trusted_html', { multiline: true }),
          field('Expected', true, 'markdown', 'trusted_html', { multiline: true }),
          field('Explanation', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Rule', false, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
    );
  }

  return {
    packId: 'programming-core',
    label: 'Programming Core',
    version: PACK_CATALOG_VERSION,
    domains: ['programming'],
    supportedOptions: [
      {
        name: 'deckRoot',
        type: 'string',
        required: false,
        description: 'Override the programming deck root.',
        defaultValue: 'Programming',
      },
      {
        name: 'languages',
        type: 'string_array',
        required: false,
        description: 'Limit the installed programming languages.',
        allowedValues: [...SUPPORTED_PROGRAMMING_LANGUAGES],
        defaultValue: [...SUPPORTED_PROGRAMMING_LANGUAGES],
      },
    ],
    deckRoots: [...deckRoots].sort((left, right) => left.localeCompare(right)),
    tagTemplates: Object.fromEntries(
      cardTypes.map((cardType) => [
        cardType.cardTypeId,
        ['domain::programming', `language::${cardType.cardTypeId.split('.')[2]?.split('-')[0]}`, `skill::${cardType.cardTypeId.split('-').slice(1).join('-')}`],
      ]),
    ),
    noteTypes: sharedNoteTypes,
    cardTypes,
  };
}

function createFundamentalsManifest(options?: StarterPackOptions): StarterPackManifest {
  const deckRoot = typeof options?.deckRoot === 'string' ? options.deckRoot : 'Fundamentals';
  return {
    packId: 'fundamentals-core',
    label: 'Fundamentals Core',
    version: PACK_CATALOG_VERSION,
    domains: ['fundamentals', 'engineering'],
    supportedOptions: [
      {
        name: 'deckRoot',
        type: 'string',
        required: false,
        description: 'Override the fundamentals deck root.',
        defaultValue: 'Fundamentals',
      },
    ],
    deckRoots: [deckRoot],
    tagTemplates: {
      'fundamentals.v1.concept': ['domain::fundamentals', 'skill::concept'],
      'fundamentals.v1.compare': ['domain::fundamentals', 'skill::compare'],
      'fundamentals.v1.cloze': ['domain::fundamentals', 'skill::cloze'],
    },
    noteTypes: [
      {
        modelName: 'study.v1.concept',
        fields: noteFields(['Prompt', 'Answer', 'DetailedExplanation', 'Example']),
        templates: conceptTemplate(),
        css: sharedCardCss,
      },
      {
        modelName: 'study.v1.compare',
        fields: noteFields(['Prompt', 'ItemA', 'ItemB', 'KeyDifference', 'WhenToUse', 'Example']),
        templates: compareTemplate(),
        css: sharedCardCss,
      },
      {
        modelName: 'study.v1.cloze',
        fields: noteFields(['Text', 'Extra']),
        templates: clozeTemplate(),
        css: sharedCardCss,
        isCloze: true,
      },
    ],
    cardTypes: [
      {
        cardTypeId: 'fundamentals.v1.concept',
        label: 'Fundamentals Concept',
        modelName: 'study.v1.concept',
        defaultDeck: `${deckRoot}::Concept`,
        source: 'custom',
        requiredFields: ['Prompt', 'Answer'],
        optionalFields: ['DetailedExplanation', 'Example'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          field('Prompt', true, 'text', 'safe_inline_html'),
          field('Answer', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('DetailedExplanation', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Example', false, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
      {
        cardTypeId: 'fundamentals.v1.compare',
        label: 'Fundamentals Compare',
        modelName: 'study.v1.compare',
        defaultDeck: `${deckRoot}::Compare`,
        source: 'custom',
        requiredFields: ['Prompt', 'ItemA', 'ItemB', 'KeyDifference'],
        optionalFields: ['WhenToUse', 'Example'],
        renderIntent: 'production',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [
          field('Prompt', true, 'text', 'safe_inline_html'),
          field('ItemA', true, 'text', 'safe_inline_html'),
          field('ItemB', true, 'text', 'safe_inline_html'),
          field('KeyDifference', true, 'markdown', 'safe_inline_html', { multiline: true }),
          field('WhenToUse', false, 'markdown', 'safe_inline_html', { multiline: true }),
          field('Example', false, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
      {
        cardTypeId: 'fundamentals.v1.cloze',
        label: 'Fundamentals Cloze',
        modelName: 'study.v1.cloze',
        defaultDeck: `${deckRoot}::Cloze`,
        source: 'custom',
        requiredFields: ['Text'],
        optionalFields: ['Extra'],
        renderIntent: 'cloze',
        allowedHtmlPolicy: 'trusted_html',
        fields: [
          field('Text', true, 'html', 'trusted_html', { multiline: true, hint: 'Use cloze markers like {{c1::answer}}.' }),
          field('Extra', false, 'markdown', 'safe_inline_html', { multiline: true }),
        ],
      },
    ],
  };
}

export function listStarterPacks(): StarterPackSummary[] {
  return [
    createEnglishManifest(),
    createFundamentalsManifest(),
    createProgrammingManifest(),
  ]
    .map(({ noteTypes: _noteTypes, cardTypes: _cardTypes, deckRoots, ...summary }) => ({
      ...summary,
      supportedOptions: summary.supportedOptions.map((option) => ({ ...option })),
      domains: [...summary.domains],
    }))
    .sort((left, right) => left.packId.localeCompare(right.packId));
}

export function resolveStarterPack(packId: string, options?: StarterPackOptions): StarterPackManifest | undefined {
  if (packId === 'english-core') {
    return createEnglishManifest(options);
  }
  if (packId === 'programming-core') {
    return createProgrammingManifest(options);
  }
  if (packId === 'fundamentals-core') {
    return createFundamentalsManifest(options);
  }
  return undefined;
}
