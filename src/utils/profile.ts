import { AppError } from '../contracts/errors.js';

export function resolveProfileId(input: {
  providedProfileId?: string;
  activeProfileId?: string;
  requireExplicitForWrite: boolean;
}): string {
  if (input.providedProfileId) {
    return input.providedProfileId;
  }

  if (input.requireExplicitForWrite) {
    throw new AppError('PROFILE_REQUIRED', 'profileId is required for write operations', {
      hint: 'Pass profileId explicitly for mutating tools.',
    });
  }

  if (input.activeProfileId) {
    return input.activeProfileId;
  }

  throw new AppError('PROFILE_REQUIRED', 'Unable to resolve active profile', {
    hint: 'Provide profileId or set ANKI_ACTIVE_PROFILE.',
  });
}
