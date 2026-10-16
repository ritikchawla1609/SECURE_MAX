import 'server-only';

export interface CanonicalAADParams {
  assetId: string;
  tenantId?: string;
  keyVersion?: string;
  purpose?: string;
  algorithm?: string;
}

/**
 * Builds canonical, deterministic Additional Authenticated Data (AAD) string.
 * Binds asset ID, tenant ID, key version, algorithm, and purpose to prevent
 * ciphertext swapping, cross-asset replay, and cross-tenant leakage.
 */
export function buildCanonicalAAD(params: CanonicalAADParams): string {
  const v = params.keyVersion || 'v1';
  const tenant = params.tenantId || 'ORG-SMX-001';
  const purpose = params.purpose || 'asset_encryption';
  const alg = params.algorithm || 'aes-256-gcm';
  return `SECUREMAX_AAD:v1|asset_id=${params.assetId}|tenant_id=${tenant}|key_ver=${v}|purpose=${purpose}|alg=${alg}`;
}

export interface WrappedDEKPayload {
  cipher: string;      // Base64 ciphertext of DEK
  iv: string;          // Base64 12-byte IV
  authTag: string;     // Base64 16-byte authentication tag
  keyVersion: string;  // e.g. 'v1', 'v2'
  algorithm: string;   // 'aes-256-gcm'
  aad: string;         // Canonical AAD used during wrapping
}

export interface KMSProvider {
  readonly providerId: string;
  readonly isProductionReady: boolean;

  /**
   * Encrypts and wraps a plaintext DEK using an asset-specific Key Encryption Key (KEK).
   */
  wrapDEK(
    dek: Buffer,
    assetId: string,
    options?: {
      tenantId?: string;
      keyVersion?: string;
    }
  ): Promise<WrappedDEKPayload>;

  /**
   * Unwraps and decrypts a wrapped DEK into plaintext.
   * Enforces independent key-use authorization, revocation checks, and integrity verification.
   */
  unwrapDEK(
    wrapped: WrappedDEKPayload,
    assetId: string,
    options?: {
      tenantId?: string;
    }
  ): Promise<Buffer>;

  /**
   * Rotates key material for an asset, producing a new key version and re-wrapping the DEK.
   */
  rotateKey(
    assetId: string,
    options?: {
      tenantId?: string;
    }
  ): Promise<{ newKeyVersion: string; wrapped: WrappedDEKPayload }>;

  /**
   * Permanently revokes key access for an asset or specific key version.
   */
  revokeKey(assetId: string, keyVersion?: string): Promise<void>;

  /**
   * Checks whether key access has been revoked for an asset.
   */
  isKeyRevoked(assetId: string, keyVersion?: string): Promise<boolean>;
}
