export const ERROR_CODES = [
  "INVALID_ARGUMENT",
  "NOT_FOUND",
  "CONFLICT",
  "DEPENDENCY_UNAVAILABLE",
  "PROFILE_REQUIRED",
  "PROFILE_SCOPE_MISMATCH",
  "FORBIDDEN_OPERATION",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const RETRYABLE_BY_CODE: Record<ErrorCode, boolean> = {
  INVALID_ARGUMENT: false,
  NOT_FOUND: false,
  CONFLICT: false,
  DEPENDENCY_UNAVAILABLE: true,
  PROFILE_REQUIRED: false,
  PROFILE_SCOPE_MISMATCH: false,
  FORBIDDEN_OPERATION: false,
};

export type ErrorPayload = {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  hint?: string;
  context?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { hint?: string; context?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.hint = options?.hint;
    this.context = options?.context;
  }

  toPayload(): ErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: RETRYABLE_BY_CODE[this.code],
      hint: this.hint,
      context: this.context,
    };
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError("DEPENDENCY_UNAVAILABLE", error.message);
  }
  return new AppError("DEPENDENCY_UNAVAILABLE", "Unknown error", { context: { error } });
}
