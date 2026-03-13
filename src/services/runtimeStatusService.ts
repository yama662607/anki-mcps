import type { AnkiGateway } from "../gateway/ankiGateway.js";
import { resolveProfileId } from "../utils/profile.js";

type RuntimeStatusServiceConfig = {
  activeProfileId?: string;
};

export class RuntimeStatusService {
  constructor(
    private readonly ankiGateway: AnkiGateway,
    private readonly config: RuntimeStatusServiceConfig
  ) {}

  async getRuntimeStatus(input: { profileId?: string }): Promise<{
    contractVersion: "1.0.0";
    profileId: string;
    runtime: {
      ready: boolean;
      gatewayMode: "anki-connect" | "memory";
      endpoint?: string;
      ankiConnectReachable: boolean;
      extensionInstalled: boolean;
      previewMode: "extension-preview" | "edit-dialog-fallback" | "memory" | "unavailable";
      guidance: string[];
    };
  }> {
    const profileId = resolveProfileId({
      providedProfileId: input.profileId,
      activeProfileId: this.config.activeProfileId,
      requireExplicitForWrite: false,
    });

    const capabilities = await this.ankiGateway.getRuntimeCapabilities();
    const guidance: string[] = [];

    if (capabilities.gatewayMode === "memory") {
      guidance.push(
        "Running in memory gateway mode. This is suitable for tests only, not for a real Anki collection."
      );
    } else if (!capabilities.ankiConnectReachable) {
      guidance.push("Start Anki and ensure AnkiConnect is enabled at the configured endpoint.");
    } else if (!capabilities.extensionInstalled) {
      guidance.push(
        "Install anki-connect-extension if you want direct preview instead of edit-dialog fallback."
      );
    }

    return {
      contractVersion: "1.0.0",
      profileId,
      runtime: {
        ready: capabilities.gatewayMode === "memory" || capabilities.ankiConnectReachable,
        gatewayMode: capabilities.gatewayMode,
        endpoint: capabilities.endpoint,
        ankiConnectReachable: capabilities.ankiConnectReachable,
        extensionInstalled: capabilities.extensionInstalled,
        previewMode: capabilities.previewMode,
        guidance,
      },
    };
  }
}
