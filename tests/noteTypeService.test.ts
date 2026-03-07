import { describe, expect, it } from 'vitest';
import { MemoryGateway } from '../src/gateway/memoryGateway.js';
import { NoteTypeService } from '../src/services/noteTypeService.js';

function createService() {
  const gateway = new MemoryGateway();
  const service = new NoteTypeService(gateway, { activeProfileId: 'default' });
  return { gateway, service };
}

describe('NoteTypeService', () => {
  it('lists note types and returns schema details', async () => {
    const { service } = createService();

    const listed = await service.listNoteTypes({ profileId: 'default' });
    expect(listed.noteTypes.some((item) => item.modelName === 'Basic')).toBe(true);

    const schema = await service.getNoteTypeSchema({ profileId: 'default', modelName: 'Basic' });
    expect(schema.noteType.templates[0]?.name).toBe('Card 1');
    expect(schema.noteType.fieldsOnTemplates['Card 1']?.front).toContain('Front');
  });

  it('dry-runs upsert_note_type by default', async () => {
    const { service } = createService();

    const result = await service.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.concept',
      fields: [{ name: 'Prompt' }, { name: 'Answer' }],
      templates: [{ name: 'Card 1', front: '{{Prompt}}', back: '{{FrontSide}}<hr id=answer>{{Answer}}' }],
      css: '.card { color: black; }',
    });

    expect(result.dryRun).toBe(true);
    expect(result.result.status).toBe('planned');
    expect(result.result.operations).toEqual([{ kind: 'create_model', modelName: 'ts.v1.concept' }]);
  });

  it('applies additive-safe updates and rejects destructive changes', async () => {
    const { service } = createService();

    await service.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.debug',
      fields: [{ name: 'BuggyCode' }, { name: 'Fix' }],
      templates: [{ name: 'Card 1', front: '{{BuggyCode}}', back: '{{FrontSide}}<hr id=answer>{{Fix}}' }],
      css: '.card { color: black; }',
      dryRun: false,
    });

    const updated = await service.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.debug',
      fields: [{ name: 'BuggyCode' }, { name: 'Fix' }, { name: 'RootCause' }],
      templates: [{ name: 'Card 1', front: '{{BuggyCode}}', back: '{{FrontSide}}<hr id=answer>{{Fix}}<br>{{RootCause}}' }],
      css: '.card { color: navy; }',
      dryRun: false,
    });

    expect(updated.result.status).toBe('updated');
    expect(updated.result.operations.some((item) => item.kind === 'add_field')).toBe(true);
    expect(updated.result.noteType.fields.map((field) => field.name)).toContain('RootCause');

    await expect(
      service.upsertNoteType({
        profileId: 'default',
        modelName: 'ts.v1.debug',
        fields: [{ name: 'BuggyCode' }],
        templates: [{ name: 'Card 1', front: '{{BuggyCode}}', back: '{{FrontSide}}' }],
        dryRun: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_OPERATION' });
  });

  it('accepts conditional section tags in templates', async () => {
    const { service } = createService();

    const result = await service.upsertNoteType({
      profileId: 'default',
      modelName: 'ts.v1.concept',
      fields: [{ name: 'Prompt' }, { name: 'Answer' }, { name: 'Contrast' }],
      templates: [{
        name: 'Card 1',
        front: '<div>{{Prompt}}</div>{{#Contrast}}<div>{{Contrast}}</div>{{/Contrast}}',
        back: '{{FrontSide}}<hr id=answer>{{Answer}}',
      }],
    });

    expect(result.result.status).toBe('planned');
  });
});
