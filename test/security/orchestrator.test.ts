import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authorizeAssetAccess, executeDecryption } from '../../src/lib/api/access-flow';
import * as oracle from '../../src/lib/blockchain/oracle';
import * as kms from '../../src/lib/kms';
import { supabaseAdmin } from '../../src/lib/db/client';

vi.mock('server-only', () => ({}));

// Mock DB client
vi.mock('../../src/lib/db/client', () => {
  const mockAssignment = {
    data: { status: 'ACTIVE', asset_permissions: [{ can_decrypt: true }] },
    error: null,
  };
  const mockSession = {
    data: { status: 'ACTIVE' },
    error: null,
  };
  const mockChain = {
    select: function() { return this; },
    eq: function() { return this; },
    single: function(this: any) {
      if (this.tableName === 'access_sessions') return Promise.resolve(mockSession);
      return Promise.resolve(mockAssignment);
    }
  };
  return {
    supabaseAdmin: { from: function(table: string) { return { ...mockChain, tableName: table }; } },
    createAuthenticatedClient: () => ({ from: function(table: string) { return { ...mockChain, tableName: table }; } })
  };
});

// Mock Audit Logger
vi.mock('../../src/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue('mock-hash')
}));

describe('[MOCKED UNIT TEST] Access Orchestrator & Dual-Chain Enforcement', () => {
  const VALID_USER_ID = 'did:test:user1';
  const VALID_ASSET_ID = 'asset-123';
  const VALID_SESSION_ID = 'session-456';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('TEST 1: Chain 1 authorized, Chain 2 authorized, KMS valid -> DECRYPTION ALLOWED', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: true, status: 'AUTHORIZED', chainId: 31337 });
    vi.spyOn(oracle, 'verifyChain2Policy').mockResolvedValueOnce({ allowed: true, status: 'AUTHORIZED', chainId: 31337 });
    vi.spyOn(kms, 'issueTemporaryDecryptionToken').mockResolvedValueOnce('valid-token');
    
    const res = await authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID);
    expect(res.tempToken).toBe('valid-token');
  });

  it('TEST 2: Chain 1 denied, Chain 2 authorized, KMS valid -> DECRYPTION DENIED', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: false, status: 'DENIED', chainId: 31337, reason: 'Revoked' });
    vi.spyOn(oracle, 'verifyChain2Policy').mockResolvedValueOnce({ allowed: true, status: 'AUTHORIZED', chainId: 31337 });
    
    await expect(authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID))
      .rejects.toThrow('Blockchain Identity/Access layer rejected authorization');
  });

  it('TEST 3: Chain 1 authorized, Chain 2 denied, KMS valid -> DECRYPTION DENIED', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: true, status: 'AUTHORIZED', chainId: 31337 });
    vi.spyOn(oracle, 'verifyChain2Policy').mockResolvedValueOnce({ allowed: false, status: 'DENIED', chainId: 31337, reason: 'Key Policy Inactive' });
    
    await expect(authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID))
      .rejects.toThrow('Key Management Policy rejected authorization');
  });

  it('TEST 4: Chain 1 unavailable -> DECRYPTION DENIED', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: false, status: 'UNAVAILABLE', chainId: 31337, reason: 'RPC Failure' });
    
    await expect(authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID))
      .rejects.toThrow('Blockchain Identity/Access layer rejected authorization');
  });

  it('TEST 5: Chain 2 unavailable -> DECRYPTION DENIED', async () => {
    vi.spyOn(oracle, 'verifyChain1Access').mockResolvedValueOnce({ allowed: true, status: 'AUTHORIZED', chainId: 31337 });
    vi.spyOn(oracle, 'verifyChain2Policy').mockResolvedValueOnce({ allowed: false, status: 'UNAVAILABLE', chainId: 31337, reason: 'RPC Failure' });
    
    await expect(authorizeAssetAccess('dummy-jwt', VALID_USER_ID, VALID_ASSET_ID, VALID_SESSION_ID))
      .rejects.toThrow('Key Management Policy rejected authorization');
  });

  it('TEST 6: Chain 1 authorized, Chain 2 authorized, temporary token expired -> DECRYPTION DENIED', async () => {
    // Test the executeDecryption phase
    vi.spyOn(kms, 'validateTemporaryDecryptionToken').mockRejectedValueOnce(new Error('Token Expired'));
    
    await expect(executeDecryption(VALID_ASSET_ID, Buffer.from(''), '', '', 'expired-token', VALID_SESSION_ID))
      .rejects.toThrow('Token Expired');
  });

  it('TEST 7: Chain 1 authorized, Chain 2 authorized, session revoked -> DECRYPTION DENIED', async () => {
    vi.spyOn(kms, 'validateTemporaryDecryptionToken').mockResolvedValueOnce({} as any);
    
    // Force DB to return revoked session status
    vi.spyOn(supabaseAdmin, 'from').mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { status: 'REVOKED' }, error: null })
        })
      })
    }) as any);

    await expect(executeDecryption(VALID_ASSET_ID, Buffer.from(''), '', '', 'valid-token', VALID_SESSION_ID))
      .rejects.toThrow('Session Revoked');
  });

  it('TEST 8: Chain 1 authorized, Chain 2 authorized, KMS unavailable -> DECRYPTION DENIED', async () => {
    vi.spyOn(kms, 'validateTemporaryDecryptionToken').mockResolvedValueOnce({} as any);
    vi.spyOn(kms, 'fetchAndDecryptDEK').mockRejectedValueOnce(new Error('KMS Down'));

    await expect(executeDecryption(VALID_ASSET_ID, Buffer.from(''), '', '', 'valid-token', VALID_SESSION_ID))
      .rejects.toThrow('KMS Down');
  });
});
