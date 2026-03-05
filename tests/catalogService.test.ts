import { describe, expect, it } from 'vitest';
import { CatalogService } from '../src/services/catalogService.js';

describe('CatalogService', () => {
  const service = new CatalogService();

  it('lists deterministic card types with required metadata', () => {
    const result = service.listCardTypes();
    expect(result.catalogVersion).toBeTypeOf('string');
    expect(result.cardTypes.length).toBeGreaterThanOrEqual(3);
    expect(result.cardTypes[0]).toHaveProperty('renderIntent');
    expect(result.cardTypes[0]).toHaveProperty('allowedHtmlPolicy');
  });

  it('validates fields and returns sanitization metadata', () => {
    const result = service.validateFields({
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
  });

  it('fails on unknown fields', () => {
    const result = service.validateFields({
      cardTypeId: 'language.v1.basic-bilingual',
      fields: {
        Front: 'x',
        Back: 'y',
        Unknown: 'z',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNKNOWN_FIELD')).toBe(true);
  });
});
