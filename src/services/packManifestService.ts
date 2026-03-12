import { AppError } from '../contracts/errors.js';
import type {
  CustomPackManifest,
  PackResourceBinding,
  PackResourceType,
  StarterPackManifest,
  StarterPackSummary,
} from '../contracts/types.js';
import { resolveProfileId } from '../utils/profile.js';
import { DraftStore } from '../persistence/draftStore.js';
import { listStarterPacks as listBuiltinStarterPacks } from '../contracts/starterPacks.js';

type PackManifestServiceConfig = {
  activeProfileId?: string;
};

export class PackManifestService {
  constructor(
    private readonly store: DraftStore,
    private readonly config: PackManifestServiceConfig,
  ) {}

  async listPackManifests(input: { profileId?: string; includeDeprecated?: boolean }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    items: CustomPackManifest[];
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    return {
      contractVersion: '1.0.0',
      profileId,
      items: this.store.listPackManifests(profileId, { includeDeprecated: input.includeDeprecated }),
    };
  }

  async getPackManifest(input: { profileId?: string; packId: string }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    pack: CustomPackManifest;
  }> {
    const profileId = this.resolveReadProfile(input.profileId);
    const pack = this.store.getPackManifest(profileId, input.packId, { includeDeprecated: true });
    if (!pack) {
      throw new AppError('NOT_FOUND', `Custom packId not found: ${input.packId}`);
    }
    return {
      contractVersion: '1.0.0',
      profileId,
      pack,
    };
  }

  async upsertPackManifest(input: {
    profileId: string;
    manifest: StarterPackManifest;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    status: 'created' | 'updated';
    pack: CustomPackManifest;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    this.assertManifest(input.manifest);

    const existing = this.store.getPackManifest(profileId, input.manifest.packId, { includeDeprecated: true });
    const pack = this.store.upsertPackManifest(profileId, input.manifest, new Date().toISOString());

    return {
      contractVersion: '1.0.0',
      profileId,
      status: existing ? 'updated' : 'created',
      pack,
    };
  }

  async deprecatePackManifest(input: {
    profileId: string;
    packId: string;
  }): Promise<{
    contractVersion: '1.0.0';
    profileId: string;
    pack: CustomPackManifest;
  }> {
    const profileId = this.resolveWriteProfile(input.profileId);
    return {
      contractVersion: '1.0.0',
      profileId,
      pack: this.store.deprecatePackManifest(profileId, input.packId, new Date().toISOString()),
    };
  }

  listActivePackSummaries(profileId: string): StarterPackSummary[] {
    return this.store
      .listPackManifests(profileId)
      .map((pack) => this.toSummary(pack))
      .sort((left, right) => left.packId.localeCompare(right.packId));
  }

  getActivePackManifest(profileId: string, packId: string): CustomPackManifest | undefined {
    return this.store.getPackManifest(profileId, packId);
  }

  getPackResourceOwner(
    profileId: string,
    resourceType: PackResourceType,
    resourceId: string,
  ): PackResourceBinding | undefined {
    return this.store.getPackResourceOwner(profileId, resourceType, resourceId);
  }

  replacePackResourceBindings(
    profileId: string,
    packId: string,
    bindings: Array<{ resourceType: PackResourceType; resourceId: string }>,
  ): void {
    this.store.replacePackResourceBindings(profileId, packId, bindings, new Date().toISOString());
  }

  listPackResourceBindings(profileId: string, packId: string): PackResourceBinding[] {
    return this.store.listPackResourceBindings(profileId, packId);
  }

  private toSummary(manifest: StarterPackManifest): StarterPackSummary {
    return {
      packId: manifest.packId,
      label: manifest.label,
      version: manifest.version,
      domains: [...manifest.domains],
      supportedOptions: manifest.supportedOptions.map((option) => ({ ...option })),
      source: 'custom',
    };
  }

  private resolveReadProfile(profileId?: string): string {
    return resolveProfileId({
      providedProfileId: profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });
  }

  private resolveWriteProfile(profileId: string): string {
    return resolveProfileId({
      providedProfileId: profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });
  }

  private assertManifest(manifest: StarterPackManifest): void {
    const builtinIds = new Set(listBuiltinStarterPacks().map((item) => item.packId));
    if (builtinIds.has(manifest.packId)) {
      throw new AppError('CONFLICT', `Builtin packId cannot be overridden: ${manifest.packId}`, {
        hint: 'Choose a new custom packId instead of shadowing a built-in pack.',
      });
    }

    this.assertUnique(
      manifest.supportedOptions.map((option) => option.name),
      'Duplicate supported option names are not allowed',
    );
    this.assertUnique(
      manifest.noteTypes.map((noteType) => noteType.modelName),
      'Duplicate note type modelName values are not allowed',
    );
    this.assertUnique(
      manifest.cardTypes.map((cardType) => cardType.cardTypeId),
      'Duplicate cardTypeId values are not allowed',
    );

    const cardTypeIds = new Set(manifest.cardTypes.map((cardType) => cardType.cardTypeId));
    for (const [cardTypeId] of Object.entries(manifest.tagTemplates)) {
      if (!cardTypeIds.has(cardTypeId)) {
        throw new AppError('INVALID_ARGUMENT', `tagTemplates references unknown cardTypeId: ${cardTypeId}`);
      }
    }

    for (const option of manifest.supportedOptions) {
      if (option.type === 'string' && Array.isArray(option.defaultValue)) {
        throw new AppError('INVALID_ARGUMENT', `Option ${option.name} must use a string defaultValue`);
      }
      if (option.type === 'string_array' && option.defaultValue !== undefined && !Array.isArray(option.defaultValue)) {
        throw new AppError('INVALID_ARGUMENT', `Option ${option.name} must use an array defaultValue`);
      }
      if (option.allowedValues && option.defaultValue !== undefined) {
        const values = Array.isArray(option.defaultValue) ? option.defaultValue : [option.defaultValue];
        const invalid = values.filter((value) => !option.allowedValues?.includes(value));
        if (invalid.length > 0) {
          throw new AppError('INVALID_ARGUMENT', `Option ${option.name} defaultValue contains unsupported values: ${invalid.join(', ')}`);
        }
      }
    }

    for (const cardType of manifest.cardTypes) {
      if (cardType.source !== 'custom') {
        throw new AppError('INVALID_ARGUMENT', `Custom pack cardTypeId must declare source=custom: ${cardType.cardTypeId}`);
      }
    }
  }

  private assertUnique(values: string[], message: string): void {
    if (new Set(values).size !== values.length) {
      throw new AppError('INVALID_ARGUMENT', message);
    }
  }
}
