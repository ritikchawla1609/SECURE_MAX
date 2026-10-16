import { describe, it, expect, vi, beforeEach } from 'vitest';
import { issueTemporaryDecryptionToken, validateTemporaryDecryptionToken, createAssetKey, fetchAndDecryptDEK } from '../../src/lib/kms';
import { authorizeAssetAccess } from '../../src/lib/api/access-flow';
import { encryptData, decryptData, generateDEK } from '../../src/lib/crypto';
import * as oracle from '../../src/lib/blockchain/oracle';
import { SignJWT } from 'jose';

vi.mock('server-only', () => ({}));

// Mock Supabase to prevent actual DB inserts during unit testing
vi.mock('../../src/lib/db/client', () => {
  const mockSingle = {
    data: {
      status: 'ACTIVE',
      asset_permissions: [{ can_decrypt: true }],
      key_versions: [{
        encrypted_dek: JSON.stringify({ cipher: 'mock', auth: 'mock' }),
        dek_iv: 'mock',
        status: 'ACTIVE'
      }]
    },
    error: null
  };

  const mockChain = {
    select: () => mockChain,
    eq: () => mockChain,
    single: () => Promise.resolve(mockSingle),
    insert: () => mockChain,
    update: () => mockChain,
  };

  const clientInstance = {
    from: () => mockChain
  };

  return {
    supabaseAdmin: clientInstance,
    createAuthenticatedClient: () => clientInstance
  };
});

vi.mock('../../src/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue('mock-hash')
}));

describe('KMS & Temporary Authorization Security Tests', () => {
  const MASTER_KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000000';
  process.env.SECUREMAX_KMS_MASTER_KEY = MASTER_KEY_HEX;
  process.env.JWT_SECRET = 'super-secret-test-key-must-be-long-enough';
  
  const VALID_USER_ID = 'user-123';
  const VALID_ASSET_ID = 'asset-456';
  const VALID_SESSION_ID = 'session-789';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('AUTHORIZED USER CAN DECRYPT: Should issue and validate temp token correctly', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt']
    });

    const payload = await validateTemporaryDecryptionToken(token, VALID_SESSION_ID, VALID_ASSET_ID);
    expect(payload.userId).toBe(VALID_USER_ID);
    expect(payload.assetId).toBe(VALID_ASSET_ID);
  });

  it('WRONG ASSET CANNOT DECRYPT: Token binding fails on wrong asset', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt']
    });

    await expect(validateTemporaryDecryptionToken(token, VALID_SESSION_ID, 'wrong-asset-id'))
      .rejects.toThrow('Asset binding mismatch');
  });

  it('REVOKED USER / HIJACKED SESSION CANNOT DECRYPT: Token binding fails on wrong session', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt']
    });

    await expect(validateTemporaryDecryptionToken(token, 'different-session-id', VALID_ASSET_ID))
      .rejects.toThrow('Session binding mismatch');
  });

  it('WRONG PERMISSION CANNOT DECRYPT: Missing can_decrypt permission fails validation', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_read'] // Missing 'can_decrypt'
    });

    await expect(validateTemporaryDecryptionToken(token, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Permission mismatch');
  });

  it('KMS FAILURE BLOCKS DECRYPTION: Altered Ciphertext / Integrity Check Fails', async () => {
    const dek = generateDEK();
    const aad = `asset_data:${VALID_ASSET_ID}`;
    const plaintext = Buffer.from('Highly sensitive BEL data');
    
    const encrypted = encryptData(plaintext, dek, aad);
    
    // Tamper with ciphertext
    const tamperedCiphertext = encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 2) + 'AA';

    expect(() => {
      decryptData(tamperedCiphertext, dek, encrypted.iv, encrypted.authTag, aad);
    }).toThrow('Decryption failed');
  });

  it('BLOCKCHAIN 1 FAILURE BLOCKS ACCESS: Oracle mock returning false', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: false, status: 'DENIED', chainId: 11155111, reason: 'Mock denied' });
    
    await expect(
      authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID)
    ).rejects.toThrow('Blockchain Identity/Access');
  });

  it('BLOCKCHAIN 2 FAILURE BLOCKS KEY AUTHORIZATION: Oracle mock returning false', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: true, status: 'AUTHORIZED', chainId: 11155111 });
    vi.spyOn(oracle, 'verifyChain2Policy').mockResolvedValueOnce({ allowed: false, status: 'DENIED', chainId: 11155111, reason: 'Mock denied' });
    
    await expect(
      authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID)
    ).rejects.toThrow('Key Management Policy rejected');
  });

  it('EXPIRED AUTHORIZATION CANNOT DECRYPT: JWT expiration triggers rejection', async () => {
    // Manually sign an expired token using jose for the test
    const secret = new TextEncoder().encode('super-secret-test-key-must-be-long-enough');
    const expiredToken = await new SignJWT({ 
      userId: VALID_USER_ID, assetId: VALID_ASSET_ID, sessionId: VALID_SESSION_ID, permissions: ['can_decrypt'] 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Date.now() / 1000 - 3600) // 1 hour ago
      .setExpirationTime(Date.now() / 1000 - 1800) // Expired 30 mins ago
      .sign(secret);

    await expect(validateTemporaryDecryptionToken(expiredToken, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Token validation failed');
  });
});
