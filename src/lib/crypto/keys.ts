import 'server-only';
import { randomBytes, createHash, hkdfSync } from 'crypto';
import { internalError } from '../utils/errors';

/**
 * Derives a 256-bit Key Encryption Key (KEK) using HKDF-SHA256.
 * @param masterKey The root master key buffer
 * @param salt The salt string for derivation
 * @returns 256-bit KEK buffer
 */
export function deriveKEK(masterKey: Buffer, salt: string): Buffer {
  try {
    // HKDF-SHA256: hash, ikm, length, salt, info
    const kek = hkdfSync('sha256', masterKey, salt, '', 32);
    return Buffer.from(kek);
  } catch (err) {
    throw internalError('Failed to derive KEK', err);
  }
}

/**
 * Generates a random 256-bit Data Encryption Key (DEK).
 * @returns 256-bit buffer
 */
export function generateDEK(): Buffer {
  return randomBytes(32);
}

/**
 * Computes a SHA-256 hash of the provided data.
 * @param data String data to hash
 * @returns Hexadecimal hash string
 */
export function hashSHA256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Computes the event hash for the audit trail by chaining the previous hash.
 * @param eventJson The JSON string representation of the event
 * @param prevHash The hash of the previous event in the chain
 * @returns Hexadecimal hash string
 */
export function computeEventHash(eventJson: string, prevHash: string): string {
  return hashSHA256(`${eventJson}${prevHash}`);
}
