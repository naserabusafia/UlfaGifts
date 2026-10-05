import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecret, secretProblem } from '../src/features/nfc-experience/crypto/secret.ts';
import {
  decryptBytes, decryptText, deriveRecoveryKeys, deriveSecretKeys, encryptBytes, encryptText,
  generateContentKey, generateRecoveryCode, normalizeRecoveryCode, randomSalt, unwrapContentKey, wrapContentKey,
} from '../src/features/nfc-experience/crypto/keys.ts';

const FAST = 1000; // iterations for tests; production uses KDF_ITERATIONS

test('answers normalize like the backend', () => {
  assert.equal(normalizeSecret('TEXT', '  أوّل   لقاء في عمّان '), 'اول لقاء في عمان');
  assert.equal(normalizeSecret('TEXT', 'مدرسةُ الهُدى'), 'مدرسه الهدي');
  assert.equal(normalizeSecret('TEXT', 'Hello   WORLD'), 'hello world');
  assert.equal(normalizeSecret('PIN', '١٢ ٣٤٥٧'), '123457');
  assert.equal(normalizeSecret('PIN', '۴۸۲۹۱۵'), '482915');
  assert.equal(normalizeSecret('DATE', '2020-2-9'), '2020-02-09');
});

test('weak or malformed secrets are rejected', () => {
  for (const pin of ['1234', '000000', '123456', '987654', '12345a']) assert.notEqual(secretProblem('PIN', pin), null, pin);
  assert.equal(secretProblem('PIN', '482915'), null);
  assert.equal(secretProblem('DATE', '2021-02-29'), 'dateInvalid');
  assert.equal(secretProblem('DATE', '2020-02-29'), null);
  assert.equal(secretProblem('TEXT', ''), 'required');
});

test('the same answer and salt give the same keys; another answer does not', async () => {
  const salt = randomSalt();
  const a = await deriveSecretKeys('482915', salt, FAST);
  const b = await deriveSecretKeys('482915', salt, FAST);
  const c = await deriveSecretKeys('482916', salt, FAST);
  assert.match(a.authKey, /^[0-9a-f]{64}$/);
  assert.equal(a.authKey, b.authKey);
  assert.notEqual(a.authKey, c.authKey);

  const content = await generateContentKey();
  const wrapped = await wrapContentKey(content, a.kek);
  const unwrapped = await unwrapContentKey(wrapped, b.kek);
  assert.equal(await decryptText(unwrapped, await encryptText(content, 'سرّنا')), 'سرّنا');
  await assert.rejects(unwrapContentKey(wrapped, c.kek));
});

test('the recovery code unwraps the same content key, tolerating formatting', async () => {
  const code = generateRecoveryCode();
  assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/);
  assert.notEqual(generateRecoveryCode(), code);
  const content = await generateContentKey();
  const wrapped = await wrapContentKey(content, (await deriveRecoveryKeys(code)).kek);
  const typed = ` ${code.toLowerCase().replace(/-/g, ' ')} `;
  assert.equal(normalizeRecoveryCode(typed), normalizeRecoveryCode(code));
  const again = await deriveRecoveryKeys(typed);
  const key = await unwrapContentKey(wrapped, again.kek);
  const data = new Uint8Array([1, 2, 3, 250]);
  assert.deepEqual(new Uint8Array(await decryptBytes(key, await encryptBytes(content, data))), data);
});

test('ciphertext is fresh every time and tampering is detected', async () => {
  const key = await generateContentKey();
  const data = new TextEncoder().encode('photo bytes');
  const one = await encryptBytes(key, data);
  const two = await encryptBytes(key, data);
  assert.notDeepEqual(one, two);
  assert.equal(one.length, data.length + 28);
  one[one.length - 1] ^= 1;
  await assert.rejects(decryptBytes(key, one));
});
