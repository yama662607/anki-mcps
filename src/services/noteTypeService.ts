import { AppError } from '../contracts/errors.js';
import type {
  NoteTypeField,
  NoteTypeSchema,
  NoteTypeSummary,
  NoteTypeValidation,
  NoteTypeTemplate,
  NoteTypeUpsertOperation,
} from '../contracts/types.js';
import type { AnkiGateway } from '../gateway/ankiGateway.js';
import { resolveProfileId } from '../utils/profile.js';
import { lintNoteTypeDefinition } from '../utils/noteTypeLint.js';

type NoteTypeServiceConfig = {
  activeProfileId?: string;
};

export class NoteTypeService {
  constructor(
    private readonly ankiGateway: AnkiGateway,
    private readonly config: NoteTypeServiceConfig,
  ) {}

  async listNoteTypes(input: { profileId?: string }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    noteTypes: NoteTypeSummary[];
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    const noteTypes = await this.ankiGateway.listNoteTypes();
    return {
      contractVersion: '1.0.0',
      profileId,
      noteTypes,
    };
  }

  async getNoteTypeSchema(input: { profileId?: string; modelName: string }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    noteType: NoteTypeSchema;
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    const schema = await this.ankiGateway.getNoteTypeSchema(input.modelName);
    return {
      contractVersion: '1.0.0',
      profileId,
      noteType: {
        modelName: schema.modelName,
        fields: schema.fieldNames.map((name) => ({ name })),
        templates: schema.templates,
        css: schema.css,
        fieldsOnTemplates: schema.fieldsOnTemplates,
        isCloze: schema.isCloze,
      },
    };
  }

  async upsertNoteType(input: {
    profileId: string;
    modelName: string;
    fields: NoteTypeField[];
    templates: NoteTypeTemplate[];
    css?: string;
    isCloze?: boolean;
    dryRun?: boolean;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    dryRun: boolean;
    result: {
      status: 'planned' | 'created' | 'updated';
      operations: NoteTypeUpsertOperation[];
      noteType: NoteTypeSchema;
      validation: NoteTypeValidation;
    };
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const dryRun = input.dryRun ?? true;
    const targetSchema = this.buildTargetSchema(input);
    const validation = lintNoteTypeDefinition({
      modelName: targetSchema.modelName,
      fields: targetSchema.fields,
      templates: targetSchema.templates,
      css: targetSchema.css,
      isCloze: targetSchema.isCloze,
    });

    let existing: NoteTypeSchema | undefined;
    try {
      const schema = await this.ankiGateway.getNoteTypeSchema(input.modelName);
      existing = {
        modelName: schema.modelName,
        fields: schema.fieldNames.map((name) => ({ name })),
        templates: schema.templates,
        css: schema.css,
        fieldsOnTemplates: schema.fieldsOnTemplates,
        isCloze: schema.isCloze,
      };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'NOT_FOUND') {
        throw error;
      }
    }

    const operations = this.planOperations(existing, targetSchema);
    if (dryRun) {
      return {
        contractVersion: '1.0.0',
        profileId,
        dryRun,
        result: {
          status: 'planned',
          operations,
          noteType: targetSchema,
          validation,
        },
      };
    }

    if (!validation.canApply) {
      throw new AppError('INVALID_ARGUMENT', 'Note type validation failed', {
        hint: 'Call upsert_note_type with dryRun=true and fix the reported validation errors before applying.',
        context: { validation },
      });
    }

    const applied = await this.ankiGateway.upsertNoteType({
      modelName: targetSchema.modelName,
      fieldNames: targetSchema.fields.map((field) => field.name),
      templates: targetSchema.templates,
      css: targetSchema.css,
      isCloze: targetSchema.isCloze,
      newFieldNames: operations.filter((operation) => operation.kind === 'add_field').map((operation) => operation.fieldName),
      newTemplates: operations
        .filter((operation) => operation.kind === 'add_template')
        .map((operation) => {
          const template = targetSchema.templates.find((item) => item.name === operation.templateName);
          return template as NoteTypeTemplate;
        }),
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      dryRun,
      result: {
        status: existing ? 'updated' : 'created',
        operations,
        noteType: {
          modelName: applied.modelName,
          fields: applied.fieldNames.map((name) => ({ name })),
          templates: applied.templates,
          css: applied.css,
          fieldsOnTemplates: applied.fieldsOnTemplates,
          isCloze: applied.isCloze,
        },
        validation,
      },
    };
  }

  private resolveReadProfile(profileId?: string): string {
    return resolveProfileId({
      providedProfileId: profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });
  }

  private buildTargetSchema(input: {
    modelName: string;
    fields: NoteTypeField[];
    templates: NoteTypeTemplate[];
    css?: string;
    isCloze?: boolean;
  }): NoteTypeSchema {
    return {
      modelName: input.modelName,
      fields: input.fields.map((field) => ({ ...field })),
      templates: input.templates.map((template) => ({ ...template })),
      css: input.css ?? '',
      fieldsOnTemplates: Object.fromEntries(
        input.templates.map((template) => [
          template.name,
          {
            front: this.extractFieldRefs(template.front),
            back: this.extractFieldRefs(template.back),
          },
        ]),
      ),
      isCloze: input.isCloze ?? input.templates.some((template) => template.front.includes('{{cloze:') || template.back.includes('{{cloze:')),
    };
  }

  private planOperations(existing: NoteTypeSchema | undefined, target: NoteTypeSchema): NoteTypeUpsertOperation[] {
    if (!existing) {
      return [{ kind: 'create_model', modelName: target.modelName }];
    }

    if (existing.isCloze !== target.isCloze) {
      throw new AppError('FORBIDDEN_OPERATION', 'Changing cloze/non-cloze mode is not supported in Phase2');
    }

    const existingFieldNames = existing.fields.map((field) => field.name);
    const targetFieldNames = target.fields.map((field) => field.name);
    for (const fieldName of existingFieldNames) {
      if (!targetFieldNames.includes(fieldName)) {
        throw new AppError('FORBIDDEN_OPERATION', `Removing or renaming field is not allowed in Phase2: ${fieldName}`);
      }
    }

    const existingTemplatesByName = new Map(existing.templates.map((template) => [template.name, template]));
    const targetTemplateNames = target.templates.map((template) => template.name);
    for (const templateName of existingTemplatesByName.keys()) {
      if (!targetTemplateNames.includes(templateName)) {
        throw new AppError('FORBIDDEN_OPERATION', `Removing or renaming template is not allowed in Phase2: ${templateName}`);
      }
    }

    const operations: NoteTypeUpsertOperation[] = [];
    for (const fieldName of targetFieldNames) {
      if (!existingFieldNames.includes(fieldName)) {
        operations.push({ kind: 'add_field', modelName: target.modelName, fieldName });
      }
    }

    for (const template of target.templates) {
      const existingTemplate = existingTemplatesByName.get(template.name);
      if (!existingTemplate) {
        operations.push({ kind: 'add_template', modelName: target.modelName, templateName: template.name });
        continue;
      }

      if (existingTemplate.front !== template.front || existingTemplate.back !== template.back) {
        operations.push({ kind: 'update_templates', modelName: target.modelName, templateNames: [template.name] });
      }
    }

    if (existing.css !== target.css) {
      operations.push({ kind: 'update_css', modelName: target.modelName });
    }

    return operations;
  }

  private extractFieldRefs(template: string): string[] {
    const matches = [...template.matchAll(/\{\{([^}]+)\}\}/g)];
    const refs = matches
      .map((match) => match[1]?.replace(/^cloze:/, '').trim() ?? '')
      .filter((name) => name.length > 0)
      .filter((name) => !['FrontSide', 'Tags', 'Type', 'Deck', 'Subdeck', 'Card'].includes(name))
      .filter((name) => !['#', '/', '^', '!'].includes(name[0] ?? ''));
    return [...new Set(refs)];
  }
}
