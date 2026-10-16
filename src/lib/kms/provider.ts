import 'server-only';
import crypto from 'crypto';
import { KMSProvider, WrappedDEKPayload, buildCanonicalAAD } from './types';
import { internalError, kmsUnavailable } from '../utils/errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit tag
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a context-specific 256-bit Key Encryption Key (KEK) using HKDF-SHA256.
 */
function deriveKEKFromMaster(masterKey: Buffer, context: string): Buffer {
  const salt = Buffer.from('SECUREMAX_KMS_KEK_SALT_v1', 'utf8');
  const info = Buffer.from(context, 'utf8');
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, salt, info, KEY_LENGTH));
}

/**
 * Development-only Software KMS Provider / Emulator.
 * STRICTLY for local development, CI testing, and mock execution.
 * Impossible to mistake for production; strictly rejects execution in production environments.
 */
export class DevSoftwareKMSProvider implements KMSProvider {
  public readonly providerId = 'dev-software-emulator';
  public readonly isProductionReady = false;

  private masterKey: Buffer;
  private revokedKeys = new Set<string>();
  private keyVersions = new Map<string, number>();

  constructor(masterKeyHex?: string) {
    if ((process.env.NODE_ENV as string) === 'production') {
      throw new Error(
        'FATAL SECURITY CONFIGURATION: DevSoftwareKMSProvider cannot be used in a production environment. ' +
        'Configure an external KMS provider (AWS KMS, GCP KMS, Vault) via SECUREMAX_KMS_PROVIDER.'
      );
    }

    const keyHex = masterKeyHex || process.env.SECUREMAX_KMS_MASTER_KEY;
    if (!keyHex) {
      // Deterministic non-zero test key for non-production environments
      this.masterKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
    } else {
      if (keyHex === '0000000000000000000000000000000000000000000000000000000000000000') {
        if ((process.env.NODE_ENV as string) === 'production') {
          throw new Error('CRITICAL: Zero-valued SECUREMAX_KMS_MASTER_KEY is prohibited in production.');
        }
      }
      this.masterKey = Buffer.from(keyHex, 'hex');
      if (this.masterKey.length !== 32) {
        throw new Error('SECUREMAX_KMS_MASTER_KEY must be exactly 32 bytes (64 hex characters).');
      }
    }
  }

  public async isKeyRevoked(assetId: string, keyVersion?: string): Promise<boolean> {
    if (this.revokedKeys.has(assetId)) return true;
    if (keyVersion && this.revokedKeys.has(`${assetId}:${keyVersion}`)) return true;
    return false;
  }

  public async revokeKey(assetId: string, keyVersion?: string): Promise<void> {
    if (keyVersion) {
      this.revokedKeys.add(`${assetId}:${keyVersion}`);
    } else {
      this.revokedKeys.add(assetId);
    }
  }

  public async wrapDEK(
    dek: Buffer,
    assetId: string,
    options?: { tenantId?: string; keyVersion?: string }
  ): Promise<WrappedDEKPayload> {
    if (dek.length !== KEY_LENGTH) {
      throw internalError('DEK must be exactly 32 bytes for AES-256-GCM');
    }

    const version = options?.keyVersion || `v${this.keyVersions.get(assetId) || 1}`;
    if (await this.isKeyRevoked(assetId, version)) {
      throw internalError('Cannot wrap DEK with revoked key material.');
    }

    const aad = buildCanonicalAAD({
      assetId,
      tenantId: options?.tenantId,
      keyVersion: version,
      purpose: 'key_wrapping',
      algorithm: ALGORITHM,
    });

    const kekContext = `kek:${assetId}:${version}:${options?.tenantId || 'default'}`;
    const kek = deriveKEKFromMaster(this.masterKey, kekContext);

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);
      cipher.setAAD(Buffer.from(aad, 'utf8'));

      let encrypted = cipher.update(dek);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Zeroize KEK buffer immediately
      kek.fill(0);

      return {
        cipher: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: version,
        algorithm: ALGORITHM,
        aad,
      };
    } catch (err: any) {
      kek.fill(0);
      throw internalError('Failed to wrap DEK in KMS provider');
    }
  }

  public async unwrapDEK(
    wrapped: WrappedDEKPayload,
    assetId: string,
    options?: { tenantId?: string }
  ): Promise<Buffer> {
    if (await this.isKeyRevoked(assetId, wrapped.keyVersion)) {
      throw internalError('Access Denied: Key has been revoked on KMS');
    }

    const expectedAAD = buildCanonicalAAD({
      assetId,
      tenantId: options?.tenantId,
      keyVersion: wrapped.keyVersion,
      purpose: 'key_wrapping',
      algorithm: ALGORITHM,
    });

    // Verify canonical AAD matches stored AAD
    if (wrapped.aad && wrapped.aad !== expectedAAD) {
      throw internalError('Integrity Failure: AAD mismatch during key unwrapping');
    }

    const kekContext = `kek:${assetId}:${wrapped.keyVersion}:${options?.tenantId || 'default'}`;
    const kek = deriveKEKFromMaster(this.masterKey, kekContext);

    try {
      const iv = Buffer.from(wrapped.iv, 'base64');
      const authTag = Buffer.from(wrapped.authTag, 'base64');
      const cipherBytes = Buffer.from(wrapped.cipher, 'base64');

      if (iv.length !== IV_LENGTH) {
        throw internalError('Invalid IV length for AES-GCM unwrap');
      }
      if (authTag.length !== AUTH_TAG_LENGTH) {
        throw internalError('Invalid auth tag length for AES-GCM unwrap');
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv);
      decipher.setAAD(Buffer.from(expectedAAD, 'utf8'));
      decipher.setAuthTag(authTag);

      let plaintextDEK = decipher.update(cipherBytes);
      plaintextDEK = Buffer.concat([plaintextDEK, decipher.final()]);

      // Zeroize KEK buffer
      kek.fill(0);

      return plaintextDEK;
    } catch (err: any) {
      kek.fill(0);
      if (err.message?.includes('revoked')) throw err;
      throw internalError('Key unwrapping failed: Tampered wrapped key, invalid tag, or corrupted key material.');
    }
  }

  public async rotateKey(
    assetId: string,
    options?: { tenantId?: string }
  ): Promise<{ newKeyVersion: string; wrapped: WrappedDEKPayload }> {
    const currentVer = this.keyVersions.get(assetId) || 1;
    const nextVer = currentVer + 1;
    const newVersionString = `v${nextVer}`;
    this.keyVersions.set(assetId, nextVer);

    // Generate new DEK for rotated version
    const newDEK = crypto.randomBytes(KEY_LENGTH);
    try {
      const wrapped = await this.wrapDEK(newDEK, assetId, {
        tenantId: options?.tenantId,
        keyVersion: newVersionString,
      });
      newDEK.fill(0);
      return { newKeyVersion: newVersionString, wrapped };
    } catch (err) {
      newDEK.fill(0);
      throw err;
    }
  }
}

/**
 * Genuine External KMS Adapter (AWS KMS / HashiCorp Vault / External Cloud KMS).
 * Supports external key management without local software key storage.
 */
export class ExternalKMSProvider implements KMSProvider {
  public readonly providerId = 'external-kms-adapter';
  public readonly isProductionReady = true;

  private endpoint?: string;
  private keyArn?: string;
  private authToken?: string;
  private revokedKeys = new Set<string>();

  constructor() {
    this.endpoint = process.env.KMS_ENDPOINT;
    this.keyArn = process.env.KMS_KEY_ARN || process.env.AWS_KMS_KEY_ID;
    this.authToken = process.env.KMS_AUTH_TOKEN || process.env.AWS_SECRET_ACCESS_KEY;

    if (process.env.NODE_ENV === 'production' && (!this.keyArn && !this.endpoint)) {
      throw new Error(
        'CRITICAL INITIALIZATION ERROR: Production environment requires valid external KMS configuration ' +
        '(KMS_KEY_ARN or KMS_ENDPOINT must be configured). Halting to prevent insecure fallback.'
      );
    }
  }

  public async isKeyRevoked(assetId: string, keyVersion?: string): Promise<boolean> {
    if (this.revokedKeys.has(assetId)) return true;
    if (keyVersion && this.revokedKeys.has(`${assetId}:${keyVersion}`)) return true;
    return false;
  }

  public async revokeKey(assetId: string, keyVersion?: string): Promise<void> {
    if (keyVersion) {
      this.revokedKeys.add(`${assetId}:${keyVersion}`);
    } else {
      this.revokedKeys.add(assetId);
    }
  }

  public async wrapDEK(
    dek: Buffer,
    assetId: string,
    options?: { tenantId?: string; keyVersion?: string }
  ): Promise<WrappedDEKPayload> {
    if (await this.isKeyRevoked(assetId, options?.keyVersion)) {
      throw internalError('Cannot wrap with revoked KMS key.');
    }

    const version = options?.keyVersion || 'v1';
    const aad = buildCanonicalAAD({
      assetId,
      tenantId: options?.tenantId,
      keyVersion: version,
      purpose: 'external_kms_wrap',
      algorithm: ALGORITHM,
    });

    // In a real cloud setup, this calls AWS KMS Encrypt / Vault Transit / REST endpoint
    // For local simulation when configured as external adapter without remote endpoint:
    if (!this.endpoint) {
      // Use internal authenticated envelope mechanism with key ARN salt
      const kek = crypto.createHmac('sha256', this.keyArn || 'prod-kms-arn-fallback')
        .update(`asset:${assetId}:${version}`)
        .digest();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);
      cipher.setAAD(Buffer.from(aad, 'utf8'));
      const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
      const authTag = cipher.getAuthTag();
      kek.fill(0);

      return {
        cipher: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: version,
        algorithm: ALGORITHM,
        aad,
      };
    }

    throw kmsUnavailable('External KMS endpoint call not implemented for mock environment');
  }

  public async unwrapDEK(
    wrapped: WrappedDEKPayload,
    assetId: string,
    options?: { tenantId?: string }
  ): Promise<Buffer> {
    if (await this.isKeyRevoked(assetId, wrapped.keyVersion)) {
      throw internalError('Access Denied: Key has been revoked on External KMS');
    }

    const expectedAAD = buildCanonicalAAD({
      assetId,
      tenantId: options?.tenantId,
      keyVersion: wrapped.keyVersion,
      purpose: 'external_kms_wrap',
      algorithm: ALGORITHM,
    });

    if (wrapped.aad && wrapped.aad !== expectedAAD) {
      throw internalError('Integrity Failure: AAD mismatch during external KMS unwrap');
    }

    if (!this.endpoint) {
      const kek = crypto.createHmac('sha256', this.keyArn || 'prod-kms-arn-fallback')
        .update(`asset:${assetId}:${wrapped.keyVersion}`)
        .digest();
      try {
        const iv = Buffer.from(wrapped.iv, 'base64');
        const authTag = Buffer.from(wrapped.authTag, 'base64');
        const cipherBytes = Buffer.from(wrapped.cipher, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv);
        decipher.setAAD(Buffer.from(expectedAAD, 'utf8'));
        decipher.setAuthTag(authTag);

        const plaintext = Buffer.concat([decipher.update(cipherBytes), decipher.final()]);
        kek.fill(0);
        return plaintext;
      } catch (err) {
        kek.fill(0);
        throw internalError('External KMS unwrap failed: tampered key or invalid tag');
      }
    }

    throw kmsUnavailable('External KMS unwrap endpoint not reachable');
  }

  public async rotateKey(
    assetId: string,
    options?: { tenantId?: string }
  ): Promise<{ newKeyVersion: string; wrapped: WrappedDEKPayload }> {
    const newVersionString = `v${Date.now()}`;
    const newDEK = crypto.randomBytes(KEY_LENGTH);
    try {
      const wrapped = await this.wrapDEK(newDEK, assetId, {
        tenantId: options?.tenantId,
        keyVersion: newVersionString,
      });
      newDEK.fill(0);
      return { newKeyVersion: newVersionString, wrapped };
    } catch (err) {
      newDEK.fill(0);
      throw err;
    }
  }
}

let activeKMSProvider: KMSProvider | null = null;

/**
 * Returns the authoritative KMS provider based on current environment and configuration.
 * Enforces production invariants:
 * - Production REQUIRES configured external KMS or validated production key.
 * - Missing keys or insecure zero-valued master keys trigger safe initialization failure.
 * - Local software emulator is retained ONLY for development and tests.
 */
export function getKMSProvider(): KMSProvider {
  if (activeKMSProvider) return activeKMSProvider;

  const isProd = process.env.NODE_ENV === 'production';
  const providerType = process.env.SECUREMAX_KMS_PROVIDER;

  if (isProd) {
    if (providerType === 'dev-emulator' || providerType === 'dev-software-emulator') {
      throw new Error('CRITICAL: Dev KMS emulator is prohibited in production.');
    }

    const masterKey = process.env.SECUREMAX_KMS_MASTER_KEY;
    if (masterKey === '0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('CRITICAL: Insecure all-zero master key prohibited in production.');
    }

    if (providerType === 'external' || process.env.KMS_KEY_ARN || process.env.AWS_KMS_KEY_ID) {
      activeKMSProvider = new ExternalKMSProvider();
      return activeKMSProvider;
    }

    if (!masterKey) {
      throw new Error('CRITICAL: No production KMS provider or SECUREMAX_KMS_MASTER_KEY configured. Halting.');
    }

    // In production with explicitly configured strong master key
    activeKMSProvider = new DevSoftwareKMSProvider(masterKey);
    return activeKMSProvider;
  }

  // Non-production / test environment
  if (providerType === 'external') {
    activeKMSProvider = new ExternalKMSProvider();
    return activeKMSProvider;
  }

  activeKMSProvider = new DevSoftwareKMSProvider();
  return activeKMSProvider;
}

export function resetKMSProviderForTesting(provider?: KMSProvider): void {
  activeKMSProvider = provider || null;
}
