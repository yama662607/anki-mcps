import { AppError } from '../contracts/errors.js';
import { PACK_CATALOG_VERSION, listStarterPacks as listBuiltinStarterPacks, resolveStarterPack } from '../contracts/starterPacks.js';
import type { PackResourceType, StarterPackManifest, StarterPackOperation, StarterPackOptionDefinition, StarterPackOptionValue, StarterPackSummary } from '../contracts/types.js';
import { CatalogService } from './catalogService.js';
import { NoteTypeService } from './noteTypeService.js';
import { resolveProfileId } from '../utils/profile.js';
import { PackManifestService } from './packManifestService.js';

type StarterPackServiceConfig = {
  activeProfileId?: string;
};

export class StarterPackService {
  constructor(
    private readonly noteTypeService: NoteTypeService,
    private readonly catalogService: CatalogService,
    private readonly packManifestService: PackManifestService,
    private readonly config: StarterPackServiceConfig,
  ) {}

  async listStarterPacks(input: { profileId?: string }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    packCatalogVersion: string;
    packs: StarterPackSummary[];
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });

    return {
      contractVersion: '1.0.0',
      profileId,
      packCatalogVersion: PACK_CATALOG_VERSION,
      packs: this.listMergedPacks(profileId),
    };
  }

  getCatalogResourcePayload(profileId?: string) {
    return {
      contractVersion: '1.0.0',
      profileId: profileId ?? this.config.activeProfileId ?? 'default',
      packCatalogVersion: PACK_CATALOG_VERSION,
      packs: this.listMergedPacks(profileId ?? this.config.activeProfileId ?? 'default'),
    };
  }

  async applyStarterPack(input: {
    profileId: string;
    packId: string;
    version?: string;
    dryRun?: boolean;
    options?: {
      [key: string]: StarterPackOptionValue;
    };
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    pack: StarterPackSummary;
    dryRun: boolean;
    result: {
      status: 'planned' | 'applied';
      deckRoots: string[];
      tagTemplates: Record<string, string[]>;
      operations: StarterPackOperation[];
    };
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    if (input.version && input.version !== PACK_CATALOG_VERSION) {
      const builtin = resolveStarterPack(input.packId);
      if (builtin) {
        throw new AppError('INVALID_ARGUMENT', `Unsupported starter pack version: ${input.version}`, {
          hint: `Use version ${PACK_CATALOG_VERSION}.`,
        });
      }
    }

    const resolved = this.resolveManifest(profileId, input.packId, input.version, input.options);
    const { manifest, source } = resolved;
    const managedBindings: Array<{ resourceType: PackResourceType; resourceId: string }> = [];

    const dryRun = input.dryRun ?? true;
    const operations: StarterPackOperation[] = [];

    for (const noteType of manifest.noteTypes) {
      const planned = await this.noteTypeService.upsertNoteType({
        profileId,
        modelName: noteType.modelName,
        fields: noteType.fields,
        templates: noteType.templates,
        css: noteType.css,
        isCloze: noteType.isCloze,
        dryRun: true,
      });
      const status = this.classifyNoteTypeOperation(planned.result.operations);

      if (source === 'custom') {
        this.assertOwnership(profileId, manifest.packId, 'note_type', noteType.modelName, status);
        managedBindings.push({ resourceType: 'note_type', resourceId: noteType.modelName });
      }

      operations.push({ kind: 'note_type', id: noteType.modelName, status });

      if (!dryRun && status !== 'unchanged') {
        await this.noteTypeService.upsertNoteType({
          profileId,
          modelName: noteType.modelName,
          fields: noteType.fields,
          templates: noteType.templates,
          css: noteType.css,
          isCloze: noteType.isCloze,
          dryRun: false,
        });
      }
    }

    for (const cardType of manifest.cardTypes) {
      const status = this.catalogService.planCustomCardTypeDefinition(profileId, cardType);

      if (source === 'custom') {
        this.assertOwnership(profileId, manifest.packId, 'card_type_definition', cardType.cardTypeId, status);
        managedBindings.push({ resourceType: 'card_type_definition', resourceId: cardType.cardTypeId });
      }

      operations.push({ kind: 'card_type_definition', id: cardType.cardTypeId, status });
      if (!dryRun && status !== 'unchanged') {
        this.catalogService.upsertCustomCardTypeDefinition(profileId, cardType);
      }
    }

    for (const deckRoot of manifest.deckRoots) {
      operations.push({ kind: 'deck_root', id: deckRoot, status: 'unchanged' });
    }

    if (!dryRun && source === 'custom') {
      this.packManifestService.replacePackResourceBindings(profileId, manifest.packId, managedBindings);
    }

    return {
      contractVersion: '1.0.0',
      profileId,
      pack: this.toSummary(manifest),
      dryRun,
      result: {
        status: dryRun ? 'planned' : 'applied',
        deckRoots: [...manifest.deckRoots],
        tagTemplates: Object.fromEntries(
          Object.entries(manifest.tagTemplates).map(([cardTypeId, tags]) => [cardTypeId, [...tags]]),
        ),
        operations,
      },
    };
  }

  private toSummary(manifest: StarterPackManifest): StarterPackSummary {
    return {
      packId: manifest.packId,
      label: manifest.label,
      version: manifest.version,
      domains: [...manifest.domains],
      supportedOptions: manifest.supportedOptions.map((option) => ({ ...option })),
      source: manifest.source ?? 'builtin',
    };
  }

  private classifyNoteTypeOperation(
    operations: Array<{ kind: string }>,
  ): 'create' | 'update' | 'unchanged' {
    if (operations.some((operation) => operation.kind === 'create_model')) {
      return 'create';
    }
    if (operations.length > 0) {
      return 'update';
    }
    return 'unchanged';
  }

  private assertOptions(
    profileId: string,
    packId: string,
    options?: {
      [key: string]: StarterPackOptionValue;
    },
  ): Record<string, StarterPackOptionValue> {
    const supportedOptions = this.resolveManifestForValidation(profileId, packId).supportedOptions;
    const supportedByName = new Map(supportedOptions.map((option) => [option.name, option]));
    const normalized: Record<string, StarterPackOptionValue> = {};

    for (const option of supportedOptions) {
      const value = options?.[option.name];
      if (value === undefined) {
        if (option.defaultValue !== undefined) {
          normalized[option.name] = Array.isArray(option.defaultValue)
            ? [...option.defaultValue]
            : option.defaultValue;
          continue;
        }
        if (option.required) {
          throw new AppError('INVALID_ARGUMENT', `Missing required option for pack ${packId}: ${option.name}`);
        }
        continue;
      }
      normalized[option.name] = this.validateOptionValue(packId, option, value);
    }

    for (const [name, value] of Object.entries(options ?? {})) {
      const option = supportedByName.get(name);
      if (!option) {
        throw new AppError('INVALID_ARGUMENT', `Unsupported option for pack ${packId}: ${name}`);
      }
    }

    return normalized;
  }

  private resolveManifestForValidation(profileId: string, packId: string): StarterPackManifest {
    const builtin = resolveStarterPack(packId);
    if (builtin) {
      return builtin;
    }

    const custom = this.packManifestService.getActivePackManifest(profileId, packId);
    if (!custom) {
      throw new AppError('NOT_FOUND', `Unknown starter pack: ${packId}`);
    }
    return custom;
  }

  private resolveManifest(
    profileId: string,
    packId: string,
    version?: string,
    options?: Record<string, StarterPackOptionValue>,
  ): { manifest: StarterPackManifest; source: 'builtin' | 'custom' } {
    const normalizedOptions = this.assertOptions(profileId, packId, options);
    const builtin = resolveStarterPack(packId, normalizedOptions);
    if (builtin) {
      if (version && version !== builtin.version) {
        throw new AppError('INVALID_ARGUMENT', `Unsupported starter pack version: ${version}`, {
          hint: `Use version ${builtin.version}.`,
        });
      }
      return {
        manifest: builtin,
        source: 'builtin',
      };
    }

    const custom = this.packManifestService.getActivePackManifest(profileId, packId);
    if (!custom) {
      throw new AppError('NOT_FOUND', `Unknown starter pack: ${packId}`);
    }
    if (version && version !== custom.version) {
      throw new AppError('INVALID_ARGUMENT', `Unsupported starter pack version: ${version}`, {
        hint: `Use version ${custom.version}.`,
      });
    }
    return {
      manifest: custom,
      source: 'custom',
    };
  }

  private validateOptionValue(
    packId: string,
    option: StarterPackOptionDefinition,
    value: StarterPackOptionValue,
  ): StarterPackOptionValue {
    if (option.type === 'string') {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new AppError('INVALID_ARGUMENT', `Option ${option.name} must be a non-empty string`);
      }
      this.assertAllowedValues(option, [value]);
      return value;
    }

    if (!Array.isArray(value) || value.length === 0 || value.some((item) => item.trim().length === 0)) {
      throw new AppError('INVALID_ARGUMENT', `Option ${option.name} must be a non-empty string array`);
    }
    this.assertAllowedValues(option, value);
    return [...value];
  }

  private assertAllowedValues(option: StarterPackOptionDefinition, values: string[]): void {
    if (!option.allowedValues) {
      return;
    }
    const invalid = values.filter((item) => !option.allowedValues?.includes(item));
    if (invalid.length > 0) {
      throw new AppError('INVALID_ARGUMENT', `Unsupported values for option ${option.name}: ${invalid.join(', ')}`, {
        hint: `Supported values: ${option.allowedValues.join(', ')}`,
      });
    }
  }

  private assertOwnership(
    profileId: string,
    packId: string,
    resourceType: PackResourceType,
    resourceId: string,
    status: 'create' | 'update' | 'unchanged',
  ): void {
    const owner = this.packManifestService.getPackResourceOwner(profileId, resourceType, resourceId);
    if (!owner) {
      if (status === 'update') {
        throw new AppError('CONFLICT', `Custom pack cannot take over unmanaged ${resourceType}: ${resourceId}`, {
          hint: 'Use a new identifier or migrate ownership manually by recreating the resource under the pack.',
          context: { resourceType, resourceId, owner: 'unmanaged' },
        });
      }
      return;
    }

    if (owner.packId !== packId) {
      throw new AppError('CONFLICT', `Custom pack cannot modify ${resourceType} owned by another pack: ${resourceId}`, {
        hint: `Owned by pack ${owner.packId}. Use a new identifier instead of taking over shared resources.`,
        context: { resourceType, resourceId, ownerPackId: owner.packId },
      });
    }
  }

  private listMergedPacks(profileId: string): StarterPackSummary[] {
    return [
      ...listBuiltinStarterPacks().map((pack) => ({ ...pack, source: 'builtin' as const })),
      ...this.packManifestService.listActivePackSummaries(profileId),
    ].sort((left, right) => left.packId.localeCompare(right.packId));
  }
}
