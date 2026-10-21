import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  issueTemporaryDecryptionToken, 
  validateTemporaryDecryptionToken, 
  fetchAndDecryptDEK,
  redeemTokenAtomically,
  clearRedemptionsForTesting
} from '../../src/lib/kms';
import { deriveKEK, encryptData, generateDEK } from '../../src/lib/crypto';
import { deviceStore } from '../../src/lib/auth/deviceStore';
import { UserStatus } from '../../src/types';
import { SignJWT } from 'jose';
import crypto from 'crypto';

vi.mock('server-only', () => ({}));

describe('PHASE 4: Decryption Authorization & Replay Protection Suite', () => {
  const MASTER_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const VALID_USER_ID = 'user-123';
  const VALID_ASSET_ID = 'asset-replay-test';
  const VALID_SESSION_ID = 'session-replay-test';
  const VALID_TENANT_ID = 'tenant-bel-01';

  beforeEach(() => {
    vi.restoreAllMocks();
    clearRedemptionsForTesting();
    process.env.SECUREMAX_KMS_MASTER_KEY = MASTER_KEY_HEX;
    process.env.JWT_SECRET = 'test-environment-jwt-secret-minimum-32-chars-long';

    // Seed test session in deviceStore
    deviceStore.sessions.set(VALID_SESSION_ID, {
      session_id: VALID_SESSION_ID,
      user_id: VALID_USER_ID,
      device_id: 'dev_test',
      position: 'Engineer',
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      authentication_level: 'P256',
      status: 'ACTIVE',
    });

    // Seed test asset in deviceStore
    const testDek = Buffer.from('01234567890123456789012345678901', 'utf8');
    const kek = deriveKEK(MASTER_KEY_HEX, VALID_ASSET_ID);
    const aad = `key_wrapping:${VALID_ASSET_ID}`;
    const encrypted = encryptData(testDek, kek, aad);
    deviceStore.wrappedDEKs.set(VALID_ASSET_ID, {
      cipher: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
  });

  // 1. Expired token
  it('1. REJECTS EXPIRED TOKEN: Validation fails when exp is in the past', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expiredToken = await new SignJWT({
      sub: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
      operation: 'decrypt',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('securemax-kms')
      .setAudience('securemax-vault')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(secret);

    await expect(validateTemporaryDecryptionToken(expiredToken, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Token validation failed');
  });

  // 2. Invalid signature
  it('2. REJECTS INVALID SIGNATURE: Validation fails when token is forged or signature corrupted', async () => {
    const validToken = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
    });

    const parts = validToken.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -4)}XXXX`;

    await expect(validateTemporaryDecryptionToken(tamperedToken, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Token validation failed');
  });

  // 3. Incorrect issuer or audience
  it('3. REJECTS INCORRECT ISSUER OR AUDIENCE: Untrusted claims fail validation', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    
    // Wrong issuer
    const rogueIssuerToken = await new SignJWT({
      sub: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('rogue-attacker-kms')
      .setAudience('securemax-vault')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    await expect(validateTemporaryDecryptionToken(rogueIssuerToken, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Issuer mismatch');

    // Wrong audience
    const rogueAudienceToken = await new SignJWT({
      sub: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('securemax-kms')
      .setAudience('attacker-controlled-site')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    await expect(validateTemporaryDecryptionToken(rogueAudienceToken, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Audience mismatch');
  });

  // 4. Wrong operation
  it('4. REJECTS WRONG OPERATION: Token without decrypt permission fails validation', async () => {
    const readOnlyToken = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_read'], // lacks can_decrypt
      operation: 'read',
    });

    await expect(validateTemporaryDecryptionToken(readOnlyToken, VALID_SESSION_ID, VALID_ASSET_ID))
      .rejects.toThrow('Permission mismatch: Token lacks decrypt authority.');
  });

  // 5. Wrong user
  it('5. REJECTS WRONG USER: Token issued to User A cannot be used by User B', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: 'usr_alice_victim',
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
    });

    await expect(validateTemporaryDecryptionToken(
      token, 
      VALID_SESSION_ID, 
      VALID_ASSET_ID, 
      '0.0.0.0', 
      undefined, 
      { expectedUserId: 'usr_bob_attacker' }
    )).rejects.toThrow('User binding mismatch');
  });

  // 6. Wrong tenant
  it('6. REJECTS WRONG TENANT: Cross-tenant token substitution is blocked', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      tenantId: 'tenant-alpha',
      permissions: ['can_decrypt'],
    });

    await expect(validateTemporaryDecryptionToken(token, VALID_SESSION_ID, VALID_ASSET_ID, '0.0.0.0', 'tenant-beta'))
      .rejects.toThrow('Tenant binding mismatch');
  });

  // 7. Wrong asset
  it('7. REJECTS WRONG ASSET: Token for Asset A cannot unwrap Asset B', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: 'asset-radar-01',
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
    });

    await expect(validateTemporaryDecryptionToken(token, VALID_SESSION_ID, 'asset-avionics-02'))
      .rejects.toThrow('Asset binding mismatch');
  });

  // 8. Wrong key version
  it('8. REJECTS WRONG KEY VERSION: Token bound to v1 fails when validating against v2', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      keyVersionId: 'v1',
      permissions: ['can_decrypt'],
    });

    await expect(validateTemporaryDecryptionToken(
      token,
      VALID_SESSION_ID,
      VALID_ASSET_ID,
      '0.0.0.0',
      undefined,
      { expectedKeyVersionId: 'v2' }
    )).rejects.toThrow('Key version mismatch');
  });

  // 9. Wrong session
  it('9. REJECTS WRONG SESSION: Replaying token in different session context fails', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: 'session-legit-device-1',
      permissions: ['can_decrypt'],
    });

    await expect(validateTemporaryDecryptionToken(token, 'session-hijacked-device-2', VALID_ASSET_ID))
      .rejects.toThrow('Session binding mismatch');
  });

  // 10. Revoked session
  it('10. REJECTS REVOKED SESSION: Time-of-release revocation check blocks key release', async () => {
    const revokedSessionId = `session-revoked-${Date.now()}`;
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: revokedSessionId,
      permissions: ['can_decrypt'],
    });

    // Mark session as REVOKED in zero-trust device store
    deviceStore.sessions.set(revokedSessionId, {
      session_id: revokedSessionId,
      user_id: VALID_USER_ID,
      device_id: 'dev_mock',
      position: 'Engineer',
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      authentication_level: 'P256',
      status: 'REVOKED',
    });

    await expect(fetchAndDecryptDEK(VALID_ASSET_ID, {
      token,
      sessionId: revokedSessionId,
    })).rejects.toThrow('Session has been revoked');
  });

  // 11. Revoked identity
  it('11. REJECTS REVOKED IDENTITY: Suspended or revoked account cannot access assets', async () => {
    const suspendedUserId = `usr_suspended_${Date.now()}`;
    deviceStore.users.set(suspendedUserId, {
      id: suspendedUserId,
      name: 'Suspended Operative',
      email: `${suspendedUserId}@test.local`,
      role: 0 as any, // UserRole.USER
      kyc_status: 'VERIFIED',
      status: UserStatus.REVOKED,
      did: `did:securemax:${suspendedUserId}`,
      created_at: new Date().toISOString(),
    });

    const { authorizeAssetAccess } = await import('../../src/lib/api/access-flow');
    await expect(authorizeAssetAccess(suspendedUserId, VALID_ASSET_ID, VALID_SESSION_ID))
      .rejects.toThrow('User account is REVOKED');
  });

  // 12. Duplicate token redemption
  it('12. REJECTS DUPLICATE TOKEN REDEMPTION: One-time token cannot be redeemed twice', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      permissions: ['can_decrypt'],
    });

    // First redemption succeeds
    const key1 = await fetchAndDecryptDEK(VALID_ASSET_ID, {
      token,
      sessionId: VALID_SESSION_ID,
    });
    expect(key1).toBeDefined();

    // Second redemption fails closed
    await expect(fetchAndDecryptDEK(VALID_ASSET_ID, {
      token,
      sessionId: VALID_SESSION_ID,
    })).rejects.toThrow('Token has already been redeemed (replay detected)');
  });

  // 13. Concurrent duplicate redemption
  it('13. BLOCKS CONCURRENT DUPLICATE REDEMPTION: Race condition fails closed for one request', async () => {
    const testJti = `jti-concurrent-${Date.now()}`;
    
    // Simulate two parallel atomic redemptions for the same JTI
    const results = await Promise.allSettled([
      redeemTokenAtomically(testJti, VALID_ASSET_ID, VALID_SESSION_ID, VALID_USER_ID),
      redeemTokenAtomically(testJti, VALID_ASSET_ID, VALID_SESSION_ID, VALID_USER_ID),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly one must succeed, and the duplicate must be rejected
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason.message).toMatch(/Token redemption failed/);
    }
  });

  // 14. Database outage during redemption
  it('14. DATABASE OUTAGE DURING REDEMPTION FAILS CLOSED: Errors during DB check prevent unauthorized grant', async () => {
    const { setDbSimulatedFailureForTesting } = await import('../../src/lib/kms');
    setDbSimulatedFailureForTesting(new Error('PostgreSQL connection dropped mid-redemption'));

    const testJti = `jti-db-fail-${Date.now()}`;
    await expect(redeemTokenAtomically(testJti, VALID_ASSET_ID, VALID_SESSION_ID, VALID_USER_ID))
      .rejects.toThrow('Token redemption failed: Database error during redemption check: PostgreSQL connection dropped mid-redemption');

    setDbSimulatedFailureForTesting(null);
  });

  // 15. Policy version mismatch
  it('15. REJECTS POLICY VERSION MISMATCH: Token issued under obsolete policy version is rejected', async () => {
    const token = await issueTemporaryDecryptionToken({
      userId: VALID_USER_ID,
      assetId: VALID_ASSET_ID,
      sessionId: VALID_SESSION_ID,
      policyVersion: '1.0',
      permissions: ['can_decrypt'],
    });

    await expect(validateTemporaryDecryptionToken(
      token,
      VALID_SESSION_ID,
      VALID_ASSET_ID,
      '0.0.0.0',
      undefined,
      { expectedPolicyVersion: '2.0' }
    )).rejects.toThrow('Policy version mismatch');
  });
});
