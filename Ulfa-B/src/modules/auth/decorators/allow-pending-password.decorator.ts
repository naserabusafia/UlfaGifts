import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';

/**
 * Lets an account that still has to set its password (PENDING_PASSWORD_SET)
 * reach this route. Everything else answers 403 PASSWORD_CHANGE_REQUIRED
 * until the password is set.
 */
export const AllowPendingPassword = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
