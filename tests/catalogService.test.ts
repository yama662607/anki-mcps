import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { CatalogService } from '../src/services/catalogService.js';
import { DraftStore } from '../src/persistence/draftStore.js';

const dbPath = resolve(process.cwd(), '.data/test-catalog.sqlite');

afterEach(() => {
  try {
    rmSync(dbPath, { force: true });
  } catch {
    // ignore
  }
});

describe('CatalogService', () => {
  function createService() {
    const store = new DraftStore(dbPath);
    const service = new CatalogService(store);
    return { store, service };
  }

  it('lists deterministic card types with required metadata', () => {
    const { store, service } = createService();
    const result = service.listCardTypes('default');
    expect(result.catalogVersion).toBeTypeOf('string');
    expect(result.cardTypes.length).toBeGreaterThanOrEqual(3);
    expect(result.cardTypes[0]).toHaveProperty('renderIntent');
    expect(result.cardTypes[0]).toHaveProperty('allowedHtmlPolicy');
    expect(result.cardTypes[0]).toHaveProperty('source');
    store.close();
  });

  it('validates fields and returns sanitization metadata', () => {
    const { store, service } = createService();
    const result = service.validateFields({
      profileId: 'default',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: {
        Front: '<b>word</b>',
        Back: '<script>x</script>meaning',
      },
      tags: ['  z ', 'a', 'z'],
    });

    expect(result.valid).toBe(true);
    expect(result.normalized.tags).toEqual(['a', 'z']);
    expect(result.sanitization.policyByField.Front).toBe('safe_inline_html');
    expect(result.normalized.fields.Back).toBe('xmeaning');
    store.close();
  });

  it('fails on unknown fields', () => {
    const { store, service } = createService();
    const result = service.validateFields({
      profileId: 'default',
      cardTypeId: 'language.v1.basic-bilingual',
      fields: {
        Front: 'x',
        Back: 'y',
        Unknown: 'z',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNKNOWN_FIELD')).toBe(true);
    store.close();
  });

  it('omits unspecified optional fields from normalized payload', () => {
    const { store, service } = createService();
    const result = service.validateFields({
      profileId: 'default',
      cardTypeId: 'programming.v1.concept-qa',
      fields: {
        Front: 'What is narrowing?',
        Back: 'Refining a union type by runtime checks.',
      },
    });

    expect(result.valid).toBe(true);
    expect(result.normalized.fields).toEqual({
      Back: 'Refining a union type by runtime checks.',
      Front: 'What is narrowing?',
    });
    expect(result.sanitization.policyByField.Code).toBeUndefined();
    store.close();
  });

  it('merges custom card types and blocks builtin id collisions', () => {
    const { store, service } = createService();

    service.upsertCustomCardTypeDefinition('default', {
      cardTypeId: 'programming.v1.ts-concept',
      label: 'TypeScript Concept',
      modelName: 'ts.v1.concept',
      defaultDeck: 'Programming::TypeScript::Concept',
      source: 'custom',
      requiredFields: ['Prompt', 'Answer'],
      optionalFields: ['Contrast'],
      renderIntent: 'production',
      allowedHtmlPolicy: 'safe_inline_html',
      fields: [
        { name: 'Prompt', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'Answer', required: true, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html' },
        { name: 'Contrast', required: false, type: 'markdown', allowedHtmlPolicy: 'safe_inline_html' },
      ],
    });

    const listed = service.listCardTypes('default');
    expect(listed.cardTypes.some((item) => item.cardTypeId === 'programming.v1.ts-concept' && item.source === 'custom')).toBe(true);

    expect(() =>
      service.upsertCustomCardTypeDefinition('default', {
        cardTypeId: 'language.v1.basic-bilingual',
        label: 'Collision',
        modelName: 'Basic',
        defaultDeck: 'Languages::Inbox',
        source: 'custom',
        requiredFields: ['Front'],
        optionalFields: [],
        renderIntent: 'recognition',
        allowedHtmlPolicy: 'safe_inline_html',
        fields: [{ name: 'Front', required: true, type: 'text', allowedHtmlPolicy: 'safe_inline_html' }],
      }),
    ).toThrow(/Builtin cardTypeId cannot be overridden/);

    store.close();
  });
});
