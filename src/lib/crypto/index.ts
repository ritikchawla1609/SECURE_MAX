import 'server-only';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;
const SALT = process.env.SECUREMAX_KEK_SALT || 'securemax-default-salt';
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a Key Encryption Key (KEK) uniquely for a given context (e.g., asset_id)
 * using the Master Key. This limits the blast radius of a KEK compromise.
 */
export function deriveKEK(masterKeyHex: string, contextString: string): Buffer {
  const masterKey = Buffer.from(masterKeyHex, 'hex');
  if (masterKey.length !== 32) throw new Error('Master key must be exactly 32 bytes (64 hex characters).');

  // Use PBKDF2 (or HKDF) to derive a context-specific KEK
  return crypto.pbkdf2Sync(masterKey, `${SALT}:${contextString}`, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Generates a cryptographically secure random Data Encryption Key (DEK).
 */
export function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Encrypts arbitrary plaintext (e.g., file data or a DEK) using AES-256-GCM.
 * Additional Authenticated Data (AAD) is strictly bound to prevent ciphertext swapping.
 */
export function encryptData(plaintext: Buffer, key: Buffer, aadString: string): { ciphertext: string; iv: string; authTag: string } {
  if (key.length !== KEY_LENGTH) throw new Error('Encryption key must be 32 bytes.');

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Bind the AAD
  cipher.setAAD(Buffer.from(aadString, 'utf8'));

  let ciphertext = cipher.update(plaintext);
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext, enforcing strict AAD validation.
 */
export function decryptData(ciphertextBase64: string, key: Buffer, ivBase64: string, authTagBase64: string, aadString: string): Buffer {
  if (key.length !== KEY_LENGTH) throw new Error('Decryption key must be 32 bytes.');

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  // Bind the AAD
  decipher.setAAD(Buffer.from(aadString, 'utf8'));
  decipher.setAuthTag(authTag);

  try {
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);
    return plaintext;
  } catch (error) {
    throw new Error('Decryption failed: Integrity check (AAD/AuthTag) failed or corrupted data.');
  }
}

/**
 * Creates a Decipher stream for AES-256-GCM.
 * This stream can be piped into to prevent buffering large files in memory.
 */
export function createDecryptionStream(key: Buffer, ivBase64: string, authTagBase64: string, aadString: string): crypto.Decipher {
  if (key.length !== KEY_LENGTH) throw new Error('Decryption key must be 32 bytes.');

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  // Bind the AAD and Auth Tag before piping data
  decipher.setAAD(Buffer.from(aadString, 'utf8'));
  decipher.setAuthTag(authTag);
  
  return decipher;
}
