import { describe, expect, it } from "vitest";
import { AppError, asAppError, ERROR_CODES, RETRYABLE_BY_CODE } from "../src/contracts/errors.js";

describe("error contracts", () => {
  it("defines retryability for every error code", () => {
    expect(Object.keys(RETRYABLE_BY_CODE).sort()).toEqual([...ERROR_CODES].sort());
    for (const code of ERROR_CODES) {
      expect(typeof RETRYABLE_BY_CODE[code]).toBe("boolean");
    }
  });

  it("serializes AppError payload with retryability metadata", () => {
    const payload = new AppError("PROFILE_SCOPE_MISMATCH", "wrong profile").toPayload();

    expect(payload).toEqual({
      code: "PROFILE_SCOPE_MISMATCH",
      message: "wrong profile",
      retryable: false,
      hint: undefined,
      context: undefined,
    });
  });

  it("maps unknown exceptions to DEPENDENCY_UNAVAILABLE", () => {
    const error = asAppError(new Error("network down"));

    expect(error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(error.toPayload().retryable).toBe(true);
  });
});
