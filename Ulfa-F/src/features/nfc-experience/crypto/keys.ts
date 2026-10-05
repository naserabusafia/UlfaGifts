// End-to-end encryption for an NFC item (WebCrypto only).
//
// One random content key (AES-256-GCM) encrypts every photo, voice note and
// text. The server stores that key only wrapped:
//   - by a key derived from the normalized viewer answer (PBKDF2-SHA256),
//   - by a key derived from the 128-bit recovery code.
// The same PBKDF2 output also yields an "auth key" the server checks
// (bcrypt) to rate-limit attempts; it cannot be turned back into the
// wrapping key, so the server never holds anything that decrypts content.

export const KDF_ITERATIONS = 600_000;
const IV_BYTES = 12;
const subtle = () => globalThis.crypto.subtle;
const encoder = new TextEncoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function random(length: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export const randomSalt = () => toBase64(random(16));

export type DerivedKeys = { kek: CryptoKey; authKey: string };

const aesKey = (raw: Uint8Array<ArrayBuffer>, extractable = false) =>
  subtle().importKey('raw', raw, 'AES-GCM', extractable, ['encrypt', 'decrypt']);

/** Wrapping key + auth key from a normalized answer. Slow on purpose. */
export async function deriveSecretKeys(normalized: string, saltB64: string, iterations: number): Promise<DerivedKeys> {
  const base = await subtle().importKey('raw', encoder.encode(normalized), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltB64), iterations }, base, 512));
  return { kek: await aesKey(bits.slice(0, 32)), authKey: toHex(bits.slice(32)) };
}

// --- recovery code -------------------------------------------------------------

const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

/** 128 random bits as e.g. "7K3M-QX9D-…" (26 characters, groups of 4). */
export function generateRecoveryCode(): string {
  const bytes = random(17); // 130 bits of which 128 are used
  let bits = 0; let value = 0; let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5 && out.length < 26) { out += RECOVERY_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return out.match(/.{1,4}/g)!.join('-');
}

/** Canonical recovery code: tolerant of case, spaces, dashes and look-alikes. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export async function deriveRecoveryKeys(code: string): Promise<DerivedKeys> {
  // The code is already high-entropy, so a plain hash is enough to split it.
  const digest = new Uint8Array(await subtle().digest('SHA-512', encoder.encode(`ulfa-recovery:${normalizeRecoveryCode(code)}`)));
  return { kek: await aesKey(digest.slice(0, 32)), authKey: toHex(digest.slice(32)) };
}

// --- content key -----------------------------------------------------------------

export const generateContentKey = () =>
  subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as Promise<CryptoKey>;

export async function wrapContentKey(contentKey: CryptoKey, kek: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await subtle().exportKey('raw', contentKey));
  return toBase64(await encryptBytes(kek, raw));
}

export async function unwrapContentKey(wrapped: string, kek: CryptoKey): Promise<CryptoKey> {
  const raw = new Uint8Array(await decryptBytes(kek, fromBase64(wrapped)));
  // Extractable so the buyer can re-wrap it when changing the answer.
  return aesKey(raw, true);
}

// --- payloads ------------------------------------------------------------------------

/** iv (12 bytes) followed by the AES-GCM ciphertext and tag. */
export async function encryptBytes(key: CryptoKey, data: BufferSource): Promise<Uint8Array<ArrayBuffer>> {
  const iv = random(IV_BYTES);
  const ciphertext = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(IV_BYTES + ciphertext.length);
  out.set(iv); out.set(ciphertext, IV_BYTES);
  return out;
}

export async function decryptBytes(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  return subtle().decrypt({ name: 'AES-GCM', iv: data.subarray(0, IV_BYTES) }, key, data.subarray(IV_BYTES));
}

export const ENCRYPTION_OVERHEAD = IV_BYTES + 16;

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  return toBase64(await encryptBytes(key, encoder.encode(text)));
}

export async function decryptText(key: CryptoKey, value: string): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(key, fromBase64(value)));
}
