import { ViewerAuthType } from '../entities/nfc-item.entity';

export const PIN_LENGTH = 6;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Arabic-Indic and Persian digits to 0-9. */
function latinDigits(value: string): string {
  return value.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf));
}

/**
 * Canonical form of a viewer answer, so the recipient is not rejected for
 * letter case, hamza forms, diacritics or the digits their keyboard types.
 * The frontend applies the same rules before deriving the encryption key.
 */
export function normalizeViewerSecret(
  type: ViewerAuthType,
  answer: string,
): string {
  const value = latinDigits(answer.normalize('NFKC')).trim();
  switch (type) {
    case ViewerAuthType.PIN:
      return value.replace(/\s+/g, '');
    case ViewerAuthType.DATE: {
      const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
      return match
        ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
        : value;
    }
    case ViewerAuthType.TEXT:
      return value
        .toLowerCase()
        .replace(/[ً-ٰٟـ]/g, '') // tashkeel, tatweel
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ');
    default:
      return value;
  }
}

/** Why a new secret is rejected, or null when it is acceptable. */
export function viewerSecretProblem(
  type: ViewerAuthType,
  normalized: string,
): string | null {
  if (type === ViewerAuthType.NONE) return null;
  if (!normalized) return 'Viewer password is required';
  if (type === ViewerAuthType.PIN) {
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(normalized)) {
      return `PIN must be exactly ${PIN_LENGTH} digits`;
    }
    const digits = [...normalized].map(Number);
    const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]));
    // 000000, 123456, 654321 and the like.
    if (steps.size === 1 && [0, 1, -1].includes([...steps][0])) {
      return 'PIN is too easy to guess';
    }
  }
  if (type === ViewerAuthType.DATE) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    const date = match && new Date(`${normalized}T00:00:00Z`);
    if (!date || date.toISOString().slice(0, 10) !== normalized) {
      return 'Date must be a valid YYYY-MM-DD day';
    }
  }
  return null;
}
