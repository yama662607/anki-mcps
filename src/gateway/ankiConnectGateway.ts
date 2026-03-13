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

type AnkiResponse<T> = {
  result: T;
  error: string | null;
};

export class AnkiConnectGateway implements AnkiGateway {
  private guiPreviewNoteSupported: boolean | undefined;
  private guiCloseNoteDialogSupported: boolean | undefined;

  constructor(
    private readonly endpoint = process.env.ANKI_CONNECT_URL ?? "http://127.0.0.1:8765"
  ) {}

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    try {
      await this.call<number>("version", {});
    } catch {
      return {
        gatewayMode: "anki-connect",
        endpoint: this.endpoint,
        ankiConnectReachable: false,
        extensionInstalled: false,
        previewMode: "unavailable",
      };
    }

    const extensionInstalled = await this.supportsGuiPreviewNote();

    return {
      gatewayMode: "anki-connect",
      endpoint: this.endpoint,
      ankiConnectReachable: true,
      extensionInstalled,
      previewMode: extensionInstalled ? "extension-preview" : "edit-dialog-fallback",
    };
  }

  async listDecks(): Promise<string[]> {
    const decks = await this.call<string[]>("deckNames", {});
    return [...decks].sort((left, right) => left.localeCompare(right));
  }

  async createDeck(deckName: string): Promise<void> {
    await this.call<number>("createDeck", { deck: deckName });
  }

  async findNotes(query: string): Promise<number[]> {
    return this.call<number[]>("findNotes", { query });
  }

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult> {
    await this.call<number>("createDeck", { deck: input.deckName });

    const noteId = await this.call<number>("addNote", {
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

    const cardIds = await this.call<number[]>("findCards", { query: `nid:${noteId}` });
    const noteInfo = await this.getFirstNoteInfo(noteId);

    return {
      noteId,
      cardIds,
      modTimestamp: noteInfo.mod ?? Date.now(),
    };
  }

  async getNoteSnapshot(noteId: number): Promise<NoteSnapshot> {
    const noteInfo = await this.getFirstNoteInfo(noteId);
    const cardIds = await this.call<number[]>("findCards", { query: `nid:${noteId}` });
    const cards =
      cardIds.length > 0
        ? await this.call<Array<{ deckName?: string }>>("cardsInfo", { cards: cardIds })
        : [];

    const fields = Object.fromEntries(
      Object.entries(noteInfo.fields ?? {}).map(([name, payload]: [string, unknown]) => {
        const value =
          typeof payload === "object" && payload !== null && "value" in payload
            ? String((payload as { value: unknown }).value ?? "")
            : String(payload ?? "");
        return [name, value];
      })
    );

    return {
      noteId,
      cardIds,
      modelName: noteInfo.modelName,
      deckName: cards[0]?.deckName ?? "",
      fields,
      tags: (noteInfo.tags ?? []) as string[],
      modTimestamp: noteInfo.mod ?? Date.now(),
    };
  }

  async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
    await this.call<null>("updateNoteFields", {
      note: {
        id: noteId,
        fields,
      },
    });
  }

  async replaceNoteTags(noteId: number, currentTags: string[], nextTags: string[]): Promise<void> {
    const current = new Set(currentTags);
    const next = new Set(nextTags);
    const toRemove = currentTags.filter((tag) => !next.has(tag));
    const toAdd = nextTags.filter((tag) => !current.has(tag));

    if (toRemove.length > 0) {
      await this.call<null>("removeTags", { notes: [noteId], tags: toRemove.join(" ") });
    }
    if (toAdd.length > 0) {
      await this.call<null>("addTags", { notes: [noteId], tags: toAdd.join(" ") });
    }
  }

  async setCardsSuspended(cardIds: number[], suspended: boolean): Promise<void> {
    if (cardIds.length === 0) {
      return;
    }
    await this.call<boolean>(suspended ? "suspend" : "unsuspend", { cards: cardIds });
  }

  async openBrowserForNote(noteId: number): Promise<PreviewResult> {
    const query = `nid:${noteId}`;
    if (await this.supportsGuiPreviewNote()) {
      const selectedCardIds = await this.call<number[]>("findCards", { query });
      await this.call<unknown>("guiPreviewNote", { note: noteId });
      return {
        opened: true,
        browserQuery: query,
        selectedCardIds,
      };
    }

    const result = await this.call<unknown>("guiBrowse", { query });
    const selectedCardIds = Array.isArray(result) ? (result as number[]) : [];

    if (selectedCardIds.length > 0) {
      await this.call<boolean>("guiSelectCard", { card: selectedCardIds[0] });
    }

    // Fallback keeps compatibility when the extension preview path is unavailable.
    if (!(await this.supportsGuiPreviewNote())) {
      await this.call<unknown>("guiEditNote", { note: noteId });
    } else {
      await this.call<unknown>("guiPreviewNote", { note: noteId });
    }

    return {
      opened: true,
      browserQuery: query,
      selectedCardIds,
    };
  }

  async closeNoteDialog(noteId: number): Promise<boolean> {
    if (!(await this.supportsGuiCloseNoteDialog())) {
      return false;
    }

    return this.call<boolean>("guiCloseNoteDialog", { note: noteId });
  }

  async listNoteTypes(): Promise<NoteTypeSummaryResult[]> {
    const modelNames = await this.call<string[]>("modelNames", {});
    const summaries: NoteTypeSummaryResult[] = [];

    for (const modelName of modelNames) {
      const fieldNames = await this.call<string[]>("modelFieldNames", { modelName });
      const rawTemplates = await this.call<Record<string, { Front?: string; Back?: string }>>(
        "modelTemplates",
        { modelName }
      );
      const templates = Object.entries(rawTemplates).map(([name, template]) => ({
        name,
        front: template.Front ?? "",
        back: template.Back ?? "",
      }));

      summaries.push({
        modelName,
        fieldNames,
        templateNames: templates.map((template) => template.name),
        isCloze: this.detectCloze(templates),
      });
    }

    return summaries;
  }

  async getNoteTypeSchema(modelName: string): Promise<NoteTypeSchemaResult> {
    const knownModels = await this.call<string[]>("modelNames", {});
    if (!knownModels.includes(modelName)) {
      throw new AppError("NOT_FOUND", `Model not found: ${modelName}`);
    }

    const fieldNames = await this.call<string[]>("modelFieldNames", { modelName });
    const rawTemplates = await this.call<Record<string, { Front?: string; Back?: string }>>(
      "modelTemplates",
      { modelName }
    );
    const styling = await this.call<{ css?: string }>("modelStyling", { modelName });
    const rawFieldsOnTemplates = await this.call<Record<string, unknown>>(
      "modelFieldsOnTemplates",
      { modelName }
    );

    const templates = Object.entries(rawTemplates).map(([name, template]) => ({
      name,
      front: template.Front ?? "",
      back: template.Back ?? "",
    }));

    return {
      modelName,
      fieldNames,
      templates,
      css: styling.css ?? "",
      fieldsOnTemplates: this.normalizeFieldsOnTemplates(rawFieldsOnTemplates),
      isCloze: this.detectCloze(templates),
    };
  }

  async upsertNoteType(input: UpsertNoteTypeInput): Promise<NoteTypeSchemaResult> {
    const knownModels = await this.call<string[]>("modelNames", {});

    if (!knownModels.includes(input.modelName)) {
      await this.call<unknown>("createModel", {
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
      await this.call<unknown>("modelFieldAdd", {
        modelName: input.modelName,
        fieldName,
        index: input.fieldNames.indexOf(fieldName),
      });
    }

    for (const template of input.newTemplates) {
      await this.call<unknown>("modelTemplateAdd", {
        modelName: input.modelName,
        template: {
          Name: template.name,
          Front: template.front,
          Back: template.back,
        },
      });
    }

    await this.call<unknown>("updateModelTemplates", {
      model: {
        name: input.modelName,
        templates: Object.fromEntries(
          input.templates.map((template) => [
            template.name,
            {
              Front: template.front,
              Back: template.back,
            },
          ])
        ),
      },
    });

    await this.call<unknown>("updateModelStyling", {
      model: {
        name: input.modelName,
        css: input.css,
      },
    });

    return this.getNoteTypeSchema(input.modelName);
  }

  async listMediaFiles(pattern: string): Promise<string[]> {
    return this.call<string[]>("getMediaFilesNames", { pattern });
  }

  async storeMediaFile(input: StoreMediaFileInput): Promise<StoreMediaFileResult> {
    const storedFilename = await this.call<string>("storeMediaFile", {
      filename: input.filename,
      path: input.path,
      deleteExisting: false,
    });
    return { storedFilename };
  }

  async deleteNote(noteId: number): Promise<void> {
    await this.call<unknown>("deleteNotes", { notes: [noteId] });
  }

  private async supportsGuiPreviewNote(): Promise<boolean> {
    if (this.guiPreviewNoteSupported !== undefined) {
      return this.guiPreviewNoteSupported;
    }

    try {
      const reflected = await this.call<{ actions?: string[] }>("apiReflect", {
        scopes: ["actions"],
        actions: ["guiPreviewNote"],
      });
      this.guiPreviewNoteSupported =
        Array.isArray(reflected.actions) && reflected.actions.includes("guiPreviewNote");
    } catch {
      this.guiPreviewNoteSupported = false;
    }

    return this.guiPreviewNoteSupported;
  }

  private async supportsGuiCloseNoteDialog(): Promise<boolean> {
    if (this.guiCloseNoteDialogSupported !== undefined) {
      return this.guiCloseNoteDialogSupported;
    }

    try {
      const reflected = await this.call<{ actions?: string[] }>("apiReflect", {
        scopes: ["actions"],
        actions: ["guiCloseNoteDialog"],
      });
      this.guiCloseNoteDialogSupported =
        Array.isArray(reflected.actions) && reflected.actions.includes("guiCloseNoteDialog");
    } catch {
      this.guiCloseNoteDialogSupported = false;
    }

    return this.guiCloseNoteDialogSupported;
  }

  private async getFirstNoteInfo(noteId: number): Promise<Record<string, any>> {
    const notes = await this.call<Record<string, any>[]>("notesInfo", { notes: [noteId] });
    const note = notes[0];
    if (!this.isUsableNoteInfo(note)) {
      throw new AppError("NOT_FOUND", `Note not found: ${noteId}`);
    }
    return note;
  }

  private normalizeFieldsOnTemplates(
    raw: Record<string, unknown>
  ): Record<string, { front: string[]; back: string[] }> {
    return Object.fromEntries(
      Object.entries(raw).map(([templateName, entries]) => {
        const [front, back] = this.extractTemplateFieldRefs(entries);
        return [templateName, { front, back }];
      })
    );
  }

  private extractTemplateFieldRefs(entries: unknown): [string[], string[]] {
    if (
      Array.isArray(entries) &&
      entries.length >= 2 &&
      Array.isArray(entries[0]) &&
      Array.isArray(entries[1])
    ) {
      return [
        (entries[0] as unknown[]).filter((value): value is string => typeof value === "string"),
        (entries[1] as unknown[]).filter((value): value is string => typeof value === "string"),
      ];
    }

    if (Array.isArray(entries)) {
      const front = entries
        .filter(
          (entry): entry is { field?: string; ord?: number } =>
            typeof entry === "object" && entry !== null
        )
        .filter((entry) => entry.ord === 0 && typeof entry.field === "string")
        .map((entry) => entry.field as string);
      const back = entries
        .filter(
          (entry): entry is { field?: string; ord?: number } =>
            typeof entry === "object" && entry !== null
        )
        .filter((entry) => entry.ord === 1 && typeof entry.field === "string")
        .map((entry) => entry.field as string);
      return [front, back];
    }

    return [[], []];
  }

  private isUsableNoteInfo(note: unknown): note is Record<string, any> {
    return (
      typeof note === "object" &&
      note !== null &&
      typeof (note as { noteId?: unknown }).noteId === "number" &&
      typeof (note as { modelName?: unknown }).modelName === "string"
    );
  }

  private detectCloze(templates: Array<{ front: string; back: string }>): boolean {
    return templates.some(
      (template) => template.front.includes("{{cloze:") || template.back.includes("{{cloze:")
    );
  }

  private async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, version: 6, params }),
      });
    } catch (error) {
      throw new AppError("DEPENDENCY_UNAVAILABLE", "Failed to connect to AnkiConnect", {
        hint: "Ensure Anki is running with AnkiConnect enabled.",
        context: { endpoint: this.endpoint, cause: String(error) },
      });
    }

    if (!response.ok) {
      throw new AppError("DEPENDENCY_UNAVAILABLE", `AnkiConnect HTTP error: ${response.status}`);
    }

    const payload = (await response.json()) as AnkiResponse<T>;
    if (payload.error) {
      throw new AppError("DEPENDENCY_UNAVAILABLE", `AnkiConnect action failed: ${action}`, {
        context: { error: payload.error, action },
      });
    }
    return payload.result;
  }
}
