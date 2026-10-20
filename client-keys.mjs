/**
 * Reference client for Person 5 (React) and for manual testing.
 *
 * Demonstrates the private-key rule end to end:
 *   - the key pair is generated in the client with Web Crypto
 *   - only the SPKI public key is ever sent to the server
 *   - the private key signs the challenge locally and never leaves the device
 *
 * The same code runs in a browser: replace `webcrypto` with `window.crypto`
 * and persist the private key as a non-extractable IndexedDB CryptoKey.
 *
 *   node client-example/client-keys.mjs http://localhost:4001 alice@example.test "Alice"
 */
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const [baseUrl = 'http://localhost:4001', email = `user${Date.now()}@example.test`, name = 'Demo User'] =
  process.argv.slice(2);

const b64 = (buf) => Buffer.from(buf).toString('base64');

async function post(path, body, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// 1. Generate the key pair locally. extractable=false for the private key in
//    a real browser build; here it stays in memory for the duration of the run.
const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
  'sign',
  'verify',
]);
const publicKey = b64(await subtle.exportKey('spki', keyPair.publicKey));

// 2. Register. Note: no private key field exists in this payload.
const registered = await post('/api/auth/register', {
  email,
  name,
  algorithm: 'ECDSA_P256_SHA256',
  publicKey,
});
console.log('registered', registered.userId, registered.identity.publicKeyFingerprint);

// 3. Request a challenge.
const challenge = await post('/api/auth/challenge', { userId: registered.userId });

// 4. Sign the server-provided message verbatim (UTF-8).
const signature = b64(
  await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(challenge.message),
  ),
);

// 5. Exchange the signature for a session.
const session = await post('/api/auth/verify', {
  userId: registered.userId,
  challengeId: challenge.challengeId,
  signature,
});
console.log('logged in, session expires', session.expiresAt);

const me = await fetch(`${baseUrl}/api/auth/me`, {
  headers: { Authorization: `Bearer ${session.token}` },
}).then((r) => r.json());
console.log('me', me);
