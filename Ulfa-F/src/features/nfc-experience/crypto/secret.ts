// Viewer answers are normalized before they are hashed or turned into keys,
// so the recipient is not rejected for letter case, hamza forms, diacritics
// or the digits their keyboard types. Mirrors the backend's
// viewer-secret.util.ts (used there for items made before encryption).

export type SecretType = 'PIN' | 'DATE' | 'TEXT';
export const PIN_LENGTH = 6;

const latinDigits = (value: string) =>
  value.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));

export function normalizeSecret(type: SecretType, answer: string): string {
  const value = latinDigits(answer.normalize('NFKC')).trim();
  if (type === 'PIN') return value.replace(/\s+/g, '');
  if (type === 'DATE') {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
    return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : value;
  }
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

export type SecretProblem = 'required' | 'pinLength' | 'pinWeak' | 'dateInvalid' | 'textShort';

/** Why a new (normalized) secret should be rejected, or null. */
export function secretProblem(type: SecretType, normalized: string): SecretProblem | null {
  if (!normalized) return 'required';
  if (type === 'PIN') {
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(normalized)) return 'pinLength';
    const digits = [...normalized].map(Number);
    const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]));
    // 000000, 123456, 654321 and the like.
    if (steps.size === 1 && [0, 1, -1].includes([...steps][0])) return 'pinWeak';
  }
  if (type === 'DATE') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized) && new Date(`${normalized}T00:00:00Z`);
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) return 'dateInvalid';
  }
  if (type === 'TEXT' && normalized.length < 2) return 'textShort';
  return null;
}
