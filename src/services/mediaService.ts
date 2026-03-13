import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { AppError } from "../contracts/errors.js";
import type { ImportedMediaAsset, MediaKind } from "../contracts/types.js";
import type { AnkiGateway } from "../gateway/ankiGateway.js";
import { resolveProfileId } from "../utils/profile.js";

type MediaServiceConfig = {
  activeProfileId?: string;
};

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export class MediaService {
  constructor(
    private readonly ankiGateway: AnkiGateway,
    private readonly config: MediaServiceConfig
  ) {}

  async importMediaAsset(input: {
    profileId: string;
    localPath: string;
    mediaKind?: MediaKind;
    preferredFilename?: string;
  }): Promise<{
    contractVersion: "1.0.0";
    profileId: string;
    asset: ImportedMediaAsset;
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: true,
    });

    const absolutePath = resolve(input.localPath);
    if (!existsSync(absolutePath)) {
      throw new AppError("NOT_FOUND", `Local media file not found: ${absolutePath}`);
    }

    const bytes = readFileSync(absolutePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const extension = this.resolveExtension(input.preferredFilename ?? absolutePath);
    const mediaKind = input.mediaKind ?? this.inferMediaKind(extension);
    const storedFilename = `mcp-${mediaKind}-${sha256.slice(0, 16)}${extension}`;
    const existing = await this.ankiGateway.listMediaFiles(storedFilename);
    const alreadyExisted = existing.includes(storedFilename);

    if (!alreadyExisted) {
      await this.ankiGateway.storeMediaFile({
        filename: storedFilename,
        path: absolutePath,
      });
    }

    return {
      contractVersion: "1.0.0",
      profileId,
      asset: {
        mediaKind,
        sha256,
        storedFilename,
        fieldValue:
          mediaKind === "audio" ? `[sound:${storedFilename}]` : `<img src="${storedFilename}">`,
        alreadyExisted,
      },
    };
  }

  private resolveExtension(source: string): string {
    const extension = extname(source).toLowerCase();
    if (!extension) {
      throw new AppError(
        "INVALID_ARGUMENT",
        `Media filename must include an extension: ${basename(source)}`
      );
    }
    return extension;
  }

  private inferMediaKind(extension: string): MediaKind {
    if (AUDIO_EXTENSIONS.has(extension)) {
      return "audio";
    }
    if (IMAGE_EXTENSIONS.has(extension)) {
      return "image";
    }
    throw new AppError("INVALID_ARGUMENT", `Unsupported media extension: ${extension}`, {
      hint: "Supported audio: .mp3, .wav, .m4a, .ogg. Supported image: .png, .jpg, .jpeg, .gif, .webp.",
    });
  }
}
