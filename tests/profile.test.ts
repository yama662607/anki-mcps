import { describe, expect, it } from "vitest";
import { AppError } from "../src/contracts/errors.js";
import { resolveProfileId } from "../src/utils/profile.js";

describe("resolveProfileId", () => {
  it("accepts the explicit profile when it matches the active profile", () => {
    expect(
      resolveProfileId({
        providedProfileId: "active",
        activeProfileId: "active",
        requireExplicitForWrite: false,
      })
    ).toBe("active");

    expect(
      resolveProfileId({
        providedProfileId: "active",
        activeProfileId: "active",
        requireExplicitForWrite: true,
      })
    ).toBe("active");
  });

  it("uses active profile for reads when omitted", () => {
    expect(
      resolveProfileId({
        activeProfileId: "active",
        requireExplicitForWrite: false,
      })
    ).toBe("active");
  });

  it("rejects omitted write profile and missing active read profile", () => {
    expect(() =>
      resolveProfileId({
        activeProfileId: "active",
        requireExplicitForWrite: true,
      })
    ).toThrow(/profileId is required/);

    expect(() =>
      resolveProfileId({
        requireExplicitForWrite: false,
      })
    ).toThrow(/Unable to resolve active profile/);
  });

  it("rejects an explicit profile that does not match the active profile", () => {
    let error: unknown;

    try {
      resolveProfileId({
        providedProfileId: "other",
        activeProfileId: "active",
        requireExplicitForWrite: true,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("PROFILE_SCOPE_MISMATCH");
  });
});
