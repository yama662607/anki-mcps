import { AppError } from "../contracts/errors.js";
import type {
  AnkiGateway,
  CreateNoteInput,
  CreateNoteResult,
  NoteSnapshot,
  NoteTypeSchemaResult,
  NoteTypeSummaryResult,
  PreviewResult,
  RuntimeCapabilities,
  StoreMediaFileInput,
  StoreMediaFileResult,
  UpsertNoteTypeInput,
} from "./ankiGateway.js";

type InternalNote = {
  noteId: number;
  cardIds: number[];
  modelName: string;
  deckName: string;
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
  private logicalTime = Date.now();
  private readonly notes = new Map<number, InternalNote>();
  private readonly media = new Map<string, string>();
  private readonly decks = new Set<string>(["Default"]);
  private readonly models = new Map<string, InternalModel>([
    [
      "Basic",
      {
        modelName: "Basic",
        fieldNames: ["Front", "Back"],
        templates: [
          { name: "Card 1", front: "{{Front}}", back: "{{FrontSide}}<hr id=answer>{{Back}}" },
        ],
        css: ".card { font-family: arial; }",
        isCloze: false,
      },
    ],
    [
      "Cloze",
      {
        modelName: "Cloze",
        fieldNames: ["Text", "Extra"],
        templates: [
          { name: "Cloze", front: "{{cloze:Text}}", back: "{{cloze:Text}}<br>{{Extra}}" },
        ],
        css: ".card { font-family: arial; }",
        isCloze: true,
      },
    ],
  ]);

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      gatewayMode: "memory",
      ankiConnectReachable: false,
      extensionInstalled: false,
      previewMode: "memory",
    };
  }

  async listDecks(): Promise<string[]> {
    return [...this.decks].sort((left, right) => left.localeCompare(right));
  }

  async createDeck(deckName: string): Promise<void> {
    this.decks.add(deckName);
  }

  async findNotes(query: string): Promise<number[]> {
    const predicates = query
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const notes = [...this.notes.values()].filter((note) =>
      predicates.every((predicate) => this.matchesPredicate(note, predicate))
    );
    return notes.map((note) => note.noteId).sort((left, right) => left - right);
  }

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
    this.decks.add(input.deckName);
    const noteId = this.nextNoteId++;
    const cardIds = [this.nextCardId++];
    const note: InternalNote = {
      noteId,
      cardIds,
      modelName: input.modelName,
      deckName: input.deckName,
      fields: { ...input.fields },
      tags: [...input.tags],
      modTimestamp: this.nextTimestamp(),
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
      deckName: note.deckName,
      fields: { ...note.fields },
      tags: [...note.tags],
      modTimestamp: note.modTimestamp,
    };
  }

  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
    this.mutateNote(noteId, (note) => {
      note.fields = { ...fields };
    });
  }

  async replaceNoteTags(noteId: number, _currentTags: string[], nextTags: string[]): Promise<void> {
    this.mutateNote(noteId, (note) => {
      note.tags = [...nextTags];
    });
  }

  async setCardsSuspended(cardIds: number[], suspended: boolean): Promise<void> {
    for (const note of this.notes.values()) {
      if (note.cardIds.some((cardId) => cardIds.includes(cardId))) {
        note.suspended = suspended;
        note.modTimestamp = this.nextTimestamp(note.modTimestamp);
      }
    }
  }

  async openBrowserForNote(noteId: number): Promise<PreviewResult> {
    const note = this.requireNote(noteId);
    return {
      opened: true,
      browserQuery: `nid:${note.noteId}`,
      selectedCardIds: [...note.cardIds],
    };
  }

  async closeNoteDialog(noteId: number): Promise<boolean> {
    this.requireNote(noteId);
    return true;
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

  async listMediaFiles(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      `^${pattern.replace(/[.+^${}()|[\\]\\\\]/g, "\\\\$&").replace(/\\*/g, ".*")}$`
    );
    return [...this.media.keys()]
      .filter((filename) => regex.test(filename))
      .sort((left, right) => left.localeCompare(right));
  }

  async storeMediaFile(input: StoreMediaFileInput): Promise<StoreMediaFileResult> {
    this.media.set(input.filename, input.path);
    return { storedFilename: input.filename };
  }

  async deleteNote(noteId: number): Promise<void> {
    this.notes.delete(noteId);
  }

  mutateNote(noteId: number, updater: (note: InternalNote) => void): void {
    const note = this.requireNote(noteId);
    updater(note);
    note.modTimestamp = this.nextTimestamp(note.modTimestamp);
  }

  private requireNote(noteId: number): InternalNote {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new AppError("NOT_FOUND", `Note not found: ${noteId}`);
    }
    return note;
  }

  private requireModel(modelName: string): InternalModel {
    const model = this.models.get(modelName);
    if (!model) {
      throw new AppError("NOT_FOUND", `Model not found: ${modelName}`);
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
      ])
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
      .map((match) => match[1]?.replace(/^cloze:/, "").trim() ?? "")
      .filter((name) => name.length > 0 && name !== "FrontSide");
    return [...new Set(refs)];
  }

  private matchesPredicate(note: InternalNote, predicate: string): boolean {
    if (predicate === "deck:*" || predicate === "*") {
      return true;
    }
    if (predicate.startsWith("deck:")) {
      return note.deckName === this.stripQuotes(predicate.slice(5));
    }
    if (predicate.startsWith("note:")) {
      return note.modelName === this.stripQuotes(predicate.slice(5));
    }
    if (predicate.startsWith("tag:")) {
      return note.tags.includes(this.stripQuotes(predicate.slice(4)));
    }
    return true;
  }

  private stripQuotes(value: string): string {
    return value.replace(/^"+|"+$/g, "");
  }

  private nextTimestamp(previous = 0): number {
    this.logicalTime = Math.max(this.logicalTime + 1, Date.now(), previous + 1);
    return this.logicalTime;
  }
}
