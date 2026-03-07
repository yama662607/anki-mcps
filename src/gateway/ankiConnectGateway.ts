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

type AnkiResponse<T> = {
  result: T;
  error: string | null;
};

export class AnkiConnectGateway implements AnkiGateway {
  private guiPreviewNoteSupported: boolean | undefined;

  constructor(private readonly endpoint = process.env.ANKI_CONNECT_URL ?? 'http://127.0.0.1:8765') {}

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
    await this.call<number>('createDeck', { deck: input.deckName });

    const noteId = await this.call<number>('addNote', {
      note: {
        deckName: input.deckName,
        modelName: input.modelName,
        fields: input.fields,
        tags: input.tags,
        options: {
          allowDuplicate: false,
        },
      },
    });

    const cardIds = await this.call<number[]>('findCards', { query: `nid:${noteId}` });
    const noteInfo = await this.getFirstNoteInfo(noteId);

    return {
      noteId,
      cardIds,
      modTimestamp: noteInfo.mod ?? Date.now(),
    };
  }

  async getNoteSnapshot(noteId: number): Promise<NoteSnapshot> {
    const noteInfo = await this.getFirstNoteInfo(noteId);
    const cardIds = await this.call<number[]>('findCards', { query: `nid:${noteId}` });

    const fields = Object.fromEntries(
      Object.entries(noteInfo.fields ?? {}).map(([name, payload]: [string, unknown]) => {
        const value = typeof payload === 'object' && payload !== null && 'value' in payload
          ? String((payload as { value: unknown }).value ?? '')
          : String(payload ?? '');
        return [name, value];
      }),
    );

    return {
      noteId,
      cardIds,
      modelName: noteInfo.modelName,
      fields,
      tags: (noteInfo.tags ?? []) as string[],
      modTimestamp: noteInfo.mod ?? Date.now(),
    };
  }

  async openBrowserForNote(noteId: number): Promise<PreviewResult> {
    const query = `nid:${noteId}`;
    const result = await this.call<unknown>('guiBrowse', { query });
    const selectedCardIds = Array.isArray(result) ? (result as number[]) : [];

    if (selectedCardIds.length > 0) {
      await this.call<boolean>('guiSelectCard', { card: selectedCardIds[0] });
    }

    // Prefer extension API when available; fallback keeps compatibility.
    if (await this.supportsGuiPreviewNote()) {
      await this.call<unknown>('guiPreviewNote', { note: noteId });
    } else {
      await this.call<unknown>('guiEditNote', { note: noteId });
    }

    return {
      opened: true,
      browserQuery: query,
      selectedCardIds,
    };
  }

  async listNoteTypes(): Promise<NoteTypeSummaryResult[]> {
    const modelNames = await this.call<string[]>('modelNames', {});
    const schemas = await Promise.all(modelNames.map(async (modelName) => this.getNoteTypeSchema(modelName)));
    return schemas.map((schema) => ({
      modelName: schema.modelName,
      fieldNames: [...schema.fieldNames],
      templateNames: schema.templates.map((template) => template.name),
      isCloze: schema.isCloze,
    }));
  }

  async getNoteTypeSchema(modelName: string): Promise<NoteTypeSchemaResult> {
    const knownModels = await this.call<string[]>('modelNames', {});
    if (!knownModels.includes(modelName)) {
      throw new AppError('NOT_FOUND', `Model not found: ${modelName}`);
    }

    const fieldNames = await this.call<string[]>('modelFieldNames', { modelName });
    const rawTemplates = await this.call<Record<string, { Front?: string; Back?: string }>>('modelTemplates', { modelName });
    const styling = await this.call<{ css?: string }>('modelStyling', { modelName });
    const rawFieldsOnTemplates = await this.call<
      Record<string, Array<{ field?: string; ord?: number }>>
    >('modelFieldsOnTemplates', { modelName });

    const templates = Object.entries(rawTemplates).map(([name, template]) => ({
      name,
      front: template.Front ?? '',
      back: template.Back ?? '',
    }));

    return {
      modelName,
      fieldNames,
      templates,
      css: styling.css ?? '',
      fieldsOnTemplates: this.normalizeFieldsOnTemplates(rawFieldsOnTemplates),
      isCloze: this.detectCloze(templates),
    };
  }

  async upsertNoteType(input: UpsertNoteTypeInput): Promise<NoteTypeSchemaResult> {
    const knownModels = await this.call<string[]>('modelNames', {});

    if (!knownModels.includes(input.modelName)) {
      await this.call<unknown>('createModel', {
        modelName: input.modelName,
        inOrderFields: input.fieldNames,
        cardTemplates: input.templates.map((template) => ({
          Name: template.name,
          Front: template.front,
          Back: template.back,
        })),
        css: input.css,
        isCloze: input.isCloze,
      });
      return this.getNoteTypeSchema(input.modelName);
    }

    for (const fieldName of input.newFieldNames) {
      await this.call<unknown>('modelFieldAdd', {
        modelName: input.modelName,
        fieldName,
        index: input.fieldNames.indexOf(fieldName),
      });
    }

    for (const template of input.newTemplates) {
      await this.call<unknown>('modelTemplateAdd', {
        modelName: input.modelName,
        template: {
          Name: template.name,
          Front: template.front,
          Back: template.back,
        },
      });
    }

    await this.call<unknown>('updateModelTemplates', {
      model: {
        name: input.modelName,
        templates: Object.fromEntries(
          input.templates.map((template) => [
            template.name,
            {
              Front: template.front,
              Back: template.back,
            },
          ]),
        ),
      },
    });

    await this.call<unknown>('updateModelStyling', {
      model: {
        name: input.modelName,
        css: input.css,
      },
    });

    return this.getNoteTypeSchema(input.modelName);
  }

  async applyStagedIsolation(_noteId: number, cardIds: number[], _stagedTag: string): Promise<void> {
    if (cardIds.length > 0) {
      await this.call<boolean>('suspend', { cards: cardIds });
    }
  }

  async releaseStagedIsolation(noteId: number, cardIds: number[], stagedTag: string): Promise<void> {
    if (cardIds.length > 0) {
      await this.call<boolean>('unsuspend', { cards: cardIds });
    }
    await this.call<unknown>('removeTags', { notes: [noteId], tags: stagedTag });
  }

  async deleteNote(noteId: number): Promise<void> {
    await this.call<unknown>('deleteNotes', { notes: [noteId] });
  }

  private async supportsGuiPreviewNote(): Promise<boolean> {
    if (this.guiPreviewNoteSupported !== undefined) {
      return this.guiPreviewNoteSupported;
    }

    try {
      const reflected = await this.call<{ actions?: string[] }>('apiReflect', {
        scopes: ['actions'],
        actions: ['guiPreviewNote'],
      });
      this.guiPreviewNoteSupported = Array.isArray(reflected.actions) && reflected.actions.includes('guiPreviewNote');
    } catch {
      this.guiPreviewNoteSupported = false;
    }

    return this.guiPreviewNoteSupported;
  }

  private async getFirstNoteInfo(noteId: number): Promise<Record<string, any>> {
    const notes = await this.call<Record<string, any>[]>('notesInfo', { notes: [noteId] });
    const note = notes[0];
    if (!note) {
      throw new AppError('NOT_FOUND', `Note not found: ${noteId}`);
    }
    return note;
  }

  private normalizeFieldsOnTemplates(
    raw: Record<string, Array<{ field?: string; ord?: number }>>,
  ): Record<string, { front: string[]; back: string[] }> {
    return Object.fromEntries(
      Object.entries(raw).map(([templateName, entries]) => {
        const front = entries
          .filter((entry) => entry.ord === 0 && typeof entry.field === 'string')
          .map((entry) => entry.field as string);
        const back = entries
          .filter((entry) => entry.ord === 1 && typeof entry.field === 'string')
          .map((entry) => entry.field as string);
        return [templateName, { front, back }];
      }),
    );
  }

  private detectCloze(templates: Array<{ front: string; back: string }>): boolean {
    return templates.some((template) => template.front.includes('{{cloze:') || template.back.includes('{{cloze:'));
  }

  private async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, version: 6, params }),
      });
    } catch (error) {
      throw new AppError('DEPENDENCY_UNAVAILABLE', 'Failed to connect to AnkiConnect', {
        hint: 'Ensure Anki is running with AnkiConnect enabled.',
        context: { endpoint: this.endpoint, cause: String(error) },
      });
    }

    if (!response.ok) {
      throw new AppError('DEPENDENCY_UNAVAILABLE', `AnkiConnect HTTP error: ${response.status}`);
    }

    const payload = (await response.json()) as AnkiResponse<T>;
    if (payload.error) {
      throw new AppError('DEPENDENCY_UNAVAILABLE', `AnkiConnect action failed: ${action}`, {
        context: { error: payload.error, action },
      });
    }
    return payload.result;
  }
}
