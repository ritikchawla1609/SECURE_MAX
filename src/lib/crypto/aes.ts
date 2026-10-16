import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { internalError, validationError } from '../utils/errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Encrypts data using AES-256-GCM.
 * @param plaintext The data to encrypt
 * @param key The 256-bit encryption key
 * @param aad Additional authenticated data
 * @returns Object containing ciphertext, iv, and authTag
 */
export async function encryptAES256GCM(
  plaintext: Buffer,
  key: Buffer,
  aad: string
): Promise<{ ciphertext: Buffer; iv: Buffer; authTag: Buffer }> {
  if (key.length !== 32) {
    throw internalError('Invalid key length for AES-256-GCM');
  }

  return new Promise((resolve, reject) => {
    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      
      cipher.setAAD(Buffer.from(aad, 'utf8'));
      
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      resolve({
        ciphertext: encrypted,
        iv,
        authTag,
      });
    } catch (err) {
      reject(internalError('Encryption failed', err));
    }
  });
}

/**
 * Decrypts data using AES-256-GCM.
 * @param ciphertext The encrypted data
 * @param key The 256-bit encryption key
 * @param iv The initialization vector
 * @param authTag The authentication tag
 * @param aad Additional authenticated data used during encryption
 * @returns The decrypted plaintext
 */
export async function decryptAES256GCM(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  aad: string
): Promise<Buffer> {
  if (key.length !== 32) {
    throw internalError('Invalid key length for AES-256-GCM');
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw validationError('Invalid authentication tag length');
  }

  return new Promise((resolve, reject) => {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      resolve(decrypted);
    } catch (err) {
      // Fail closed, throwing an error rather than returning partial data
      reject(internalError('Decryption failed or data tampered', err));
    }
  });
}
