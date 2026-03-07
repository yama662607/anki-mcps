import { AppError } from '../contracts/errors.js';
import type {
  AnkiGateway,
  CreateNoteInput,
  CreateNoteResult,
  NoteSnapshot,
  NoteTypeSchemaResult,
  NoteTypeSummaryResult,
  PreviewResult,
  UpsertNoteTypeInput,
} from './ankiGateway.js';

type InternalNote = {
  noteId: number;
  cardIds: number[];
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  modTimestamp: number;
  suspended: boolean;
};

type InternalModel = {
  modelName: string;
  fieldNames: string[];
  templates: Array<{
    name: string;
    front: string;
    back: string;
  }>;
  css: string;
  isCloze: boolean;
};

export class MemoryGateway implements AnkiGateway {
  private nextNoteId = 1000;
  private nextCardId = 5000;
  private readonly notes = new Map<number, InternalNote>();
  private readonly models = new Map<string, InternalModel>([
    [
      'Basic',
      {
        modelName: 'Basic',
        fieldNames: ['Front', 'Back'],
        templates: [{ name: 'Card 1', front: '{{Front}}', back: '{{FrontSide}}<hr id=answer>{{Back}}' }],
        css: '.card { font-family: arial; }',
        isCloze: false,
      },
    ],
    [
      'Cloze',
      {
        modelName: 'Cloze',
        fieldNames: ['Text', 'Extra'],
        templates: [{ name: 'Cloze', front: '{{cloze:Text}}', back: '{{cloze:Text}}<br>{{Extra}}' }],
        css: '.card { font-family: arial; }',
        isCloze: true,
      },
    ],
  ]);

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
    const noteId = this.nextNoteId++;
    const cardIds = [this.nextCardId++];
    const note: InternalNote = {
      noteId,
      cardIds,
      modelName: input.modelName,
      fields: { ...input.fields },
      tags: [...input.tags],
      modTimestamp: Date.now(),
      suspended: false,
    };
    this.notes.set(noteId, note);
    return {
      noteId,
      cardIds,
      modTimestamp: note.modTimestamp,
    };
  }

  async getNoteSnapshot(noteId: number): Promise<NoteSnapshot> {
    const note = this.requireNote(noteId);
    return {
      noteId,
      cardIds: [...note.cardIds],
      modelName: note.modelName,
      fields: { ...note.fields },
      tags: [...note.tags],
      modTimestamp: note.modTimestamp,
    };
  }

  async openBrowserForNote(noteId: number): Promise<PreviewResult> {
    const note = this.requireNote(noteId);
    return {
      opened: true,
      browserQuery: `nid:${note.noteId}`,
      selectedCardIds: [...note.cardIds],
    };
  }

  async listNoteTypes(): Promise<NoteTypeSummaryResult[]> {
    return [...this.models.values()]
      .map((model) => ({
        modelName: model.modelName,
        fieldNames: [...model.fieldNames],
        templateNames: model.templates.map((template) => template.name),
        isCloze: model.isCloze,
      }))
      .sort((left, right) => left.modelName.localeCompare(right.modelName));
  }

  async getNoteTypeSchema(modelName: string): Promise<NoteTypeSchemaResult> {
    const model = this.requireModel(modelName);
    return this.materializeModel(model);
  }

  async upsertNoteType(input: UpsertNoteTypeInput): Promise<NoteTypeSchemaResult> {
    const existing = this.models.get(input.modelName);
    if (!existing) {
      this.models.set(input.modelName, {
        modelName: input.modelName,
        fieldNames: [...input.fieldNames],
        templates: input.templates.map((template) => ({ ...template })),
        css: input.css,
        isCloze: input.isCloze,
      });
      return this.getNoteTypeSchema(input.modelName);
    }

    existing.fieldNames = [...input.fieldNames];
    for (const template of input.newTemplates) {
      existing.templates.push({ ...template });
    }
    existing.templates = input.templates.map((template) => ({ ...template }));
    existing.css = input.css;
    return this.materializeModel(existing);
  }

  async applyStagedIsolation(noteId: number, _cardIds: number[], _stagedTag: string): Promise<void> {
    const note = this.requireNote(noteId);
    note.suspended = true;
    note.modTimestamp = Date.now();
  }

  async releaseStagedIsolation(noteId: number, _cardIds: number[], stagedTag: string): Promise<void> {
    const note = this.requireNote(noteId);
    note.suspended = false;
    note.tags = note.tags.filter((tag) => tag !== stagedTag);
    note.modTimestamp = Date.now();
  }

  async deleteNote(noteId: number): Promise<void> {
    this.notes.delete(noteId);
  }

  mutateNote(noteId: number, updater: (note: InternalNote) => void): void {
    const note = this.requireNote(noteId);
    updater(note);
    note.modTimestamp = Date.now();
  }

  private requireNote(noteId: number): InternalNote {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }
    return note;
  }

  private requireModel(modelName: string): InternalModel {
    const model = this.models.get(modelName);
    if (!model) {
      throw new AppError('NOT_FOUND', `Model not found: ${modelName}`);
    }
    return model;
  }

  private materializeModel(model: InternalModel): NoteTypeSchemaResult {
    const fieldsOnTemplates = Object.fromEntries(
      model.templates.map((template) => [
        template.name,
        {
          front: this.extractFieldRefs(template.front),
          back: this.extractFieldRefs(template.back),
        },
      ]),
    );

    return {
      modelName: model.modelName,
      fieldNames: [...model.fieldNames],
      templates: model.templates.map((template) => ({ ...template })),
      css: model.css,
      fieldsOnTemplates,
      isCloze: model.isCloze,
    };
  }

  private extractFieldRefs(template: string): string[] {
    const matches = [...template.matchAll(/\{\{([^}]+)\}\}/g)];
    const refs = matches
      .map((match) => match[1]?.replace(/^cloze:/, '').trim() ?? '')
      .filter((name) => name.length > 0 && name !== 'FrontSide');
    return [...new Set(refs)];
  }
}
