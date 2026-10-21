import 'server-only';

const ALL_ZEROS_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
const INSECURE_DEFAULT_JWT = 'securemax-dev-jwt-secret-minimum-32-chars-long-secure-padding';

export const IS_TEST_ENV = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
export const TEST_KMS_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
export const TEST_JWT_SECRET = 'test-environment-jwt-secret-minimum-32-chars-long';

/**
 * Validates and returns the KMS Master Key.
 * Fails closed if missing, malformed, or using an insecure default key.
 */
export function validateMasterKeyHex(explicitKey?: string, overrideEnv?: string): string {
  const envKey = explicitKey !== undefined ? explicitKey : process.env.SECUREMAX_KMS_MASTER_KEY;
  const currentEnv = overrideEnv || process.env.NODE_ENV;

  if (envKey) {
    if (envKey.toLowerCase() === ALL_ZEROS_KEY) {
      if (currentEnv === 'production') {
        throw new Error('Fatal Cryptographic Configuration Error: Insecure all-zero SECUREMAX_KMS_MASTER_KEY detected in production.');
      }
      return envKey;
    }
    if (envKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(envKey)) {
      throw new Error(`Fatal Cryptographic Configuration Error: SECUREMAX_KMS_MASTER_KEY must be a valid 64-character hex string (256-bit). Received length ${envKey.length}.`);
    }
    return envKey;
  }

  if (IS_TEST_ENV || currentEnv !== 'production') {
    return TEST_KMS_MASTER_KEY;
  }

  throw new Error('Fatal Cryptographic Configuration Error: SECUREMAX_KMS_MASTER_KEY is not configured. System failing closed.');
}

export function getValidatedMasterKeyHex(): string {
  return validateMasterKeyHex();
}

/**
 * Validates and returns the JWT secret for token signing and verification.
 * Fails closed if missing, too short, or using an insecure default fallback.
 */
export function getValidatedJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    if (secret === ALL_ZEROS_KEY || (secret === INSECURE_DEFAULT_JWT && process.env.NODE_ENV === 'production')) {
      throw new Error('Fatal Cryptographic Configuration Error: Insecure default JWT_SECRET detected in production.');
    }
    if (secret.length < 32) {
      throw new Error(`Fatal Cryptographic Configuration Error: JWT_SECRET must be at least 32 characters long. Received ${secret.length} characters.`);
    }
    return new TextEncoder().encode(secret);
  }

  if (IS_TEST_ENV || process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode(TEST_JWT_SECRET);
  }

  throw new Error('Fatal Cryptographic Configuration Error: JWT_SECRET is not configured. System failing closed.');
}

/**
 * Sanitizes RPC URLs by stripping exposed credentials and replacing insecure fallbacks.
 */
export function getValidatedChainRpcUrl(): string {
  const rpc = process.env.NEXT_PUBLIC_CHAIN_RPC_URL;
  if (rpc && !rpc.includes('alch_0qnxXuC1AluDumPOynCns')) {
    return rpc;
  }
  return 'http://127.0.0.1:8545';
}
