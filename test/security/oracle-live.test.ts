import { describe, it, expect, beforeAll, vi } from 'vitest';
import { verifyChain1Access, verifyChain2Policy } from '../../src/lib/blockchain/oracle';
import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';

vi.mock('server-only', () => ({}));

describe('[LOCAL BLOCKCHAIN INTEGRATION TEST] Oracle & Dual-Chain Execution', () => {
  let assetRegistryAddress: `0x${string}` | undefined;
  let keyLifecycleAddress: `0x${string}` | undefined;
  let isNodeLive = false;

  const publicClient = createPublicClient({ 
    chain: hardhat, 
    transport: http('http://127.0.0.1:8545', { timeout: 1000 }) 
  });

  beforeAll(async () => {
    try {
      const addressesPath = path.join(process.cwd(), 'deployed-addresses.json');
      if (fs.existsSync(addressesPath)) {
        const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
        assetRegistryAddress = addresses.contracts?.AssetRegistry || addresses.chain1?.AssetRegistry;
        keyLifecycleAddress = addresses.contracts?.KeyLifecycle || addresses.chain2?.KeyLifecycle;

        if (assetRegistryAddress) {
          process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS = assetRegistryAddress;
        }
        if (keyLifecycleAddress) {
          process.env.NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS = keyLifecycleAddress;
        }
        process.env.NEXT_PUBLIC_CHAIN_RPC_URL = 'http://127.0.0.1:8545';
        process.env.NODE_ENV = 'test';

        try {
          await publicClient.getBlockNumber();
          isNodeLive = true;
        } catch {
          isNodeLive = false;
        }
      }
    } catch (e) {
      console.error('Error loading deployed addresses:', e);
    }
  });

  describe('Local In-Memory & DeviceStore Verification', () => {
    it('should return DENIED on Chain-1 if asset exists in deviceStore but user has no assignment', async () => {
      const { deviceStore } = await import('../../src/lib/auth/deviceStore');
      const testAssetId = 'oracle-test-unassigned-' + Date.now();
      deviceStore.assets.set(testAssetId, {
        id: testAssetId,
        name: 'Classified Document',
        size: 1024,
        type: 'application/pdf',
        status: 'ENCRYPTED',
        owner_id: 'usr_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const result = await verifyChain1Access('did:securemax:unassigned_user', testAssetId);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('DENIED');
      expect(result.reason).toContain('No active assignment');
    });

    it('should return AUTHORIZED on Chain-1 if user has active assignment with can_decrypt', async () => {
      const { deviceStore } = await import('../../src/lib/auth/deviceStore');
      const testAssetId = 'oracle-test-assigned-' + Date.now();
      const testUserId = 'did:securemax:authorized_analyst';

      deviceStore.assets.set(testAssetId, {
        id: testAssetId,
        name: 'Operational Brief',
        size: 2048,
        type: 'application/pdf',
        status: 'ENCRYPTED',
        owner_id: 'usr_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      deviceStore.setAssignment(
        testAssetId,
        testUserId,
        true, // canRead
        true, // canDecrypt
        true, // canDownload
        false,
        false,
        new Date(Date.now() + 3600000).toISOString()
      );

      const result = await verifyChain1Access(testUserId, testAssetId);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('AUTHORIZED');
    });

    it('should return DENIED on Chain-1 if clearance has expired', async () => {
      const { deviceStore } = await import('../../src/lib/auth/deviceStore');
      const testAssetId = 'oracle-test-expired-' + Date.now();
      const testUserId = 'did:securemax:expired_user';

      deviceStore.assets.set(testAssetId, {
        id: testAssetId,
        name: 'Expired Document',
        size: 1024,
        type: 'text/plain',
        status: 'ENCRYPTED',
        owner_id: 'usr_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      deviceStore.setAssignment(
        testAssetId,
        testUserId,
        true, // canRead
        true, // canDecrypt
        true, // canDownload
        false,
        false,
        new Date(Date.now() - 60000).toISOString() // Expired 1 min ago
      );

      const result = await verifyChain1Access(testUserId, testAssetId);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('DENIED');
      expect(result.reason).toContain('Clearance expired');
    });

    it('should return DENIED on Chain-2 if asset key is marked REVOKED in store', async () => {
      const { deviceStore } = await import('../../src/lib/auth/deviceStore');
      const testAssetId = 'oracle-test-revoked-asset-' + Date.now();

      deviceStore.assets.set(testAssetId, {
        id: testAssetId,
        name: 'Revoked Asset',
        size: 512,
        type: 'application/json',
        status: 'REVOKED',
        owner_id: 'usr_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const result = await verifyChain2Policy(testAssetId);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('DENIED');
      expect(result.reason?.toLowerCase()).toContain('revoked');
    });
  });

  describe('Fail-Closed Fallback Invariants', () => {
    it('should fail closed when evaluating unassigned asset without local cache', async () => {
      const result = await verifyChain1Access('did:securemax:ghost_user', 'non-existent-asset-id-999');
      expect(result.allowed).toBe(false);
      expect(['DENIED', 'UNAVAILABLE', 'CONFIG_ERROR']).toContain(result.status);
    });

    it('should fail closed on Chain-2 when evaluating unregistered key without local cache', async () => {
      const result = await verifyChain2Policy('non-existent-asset-id-888');
      expect(result.allowed).toBe(false);
      expect(['DENIED', 'UNAVAILABLE', 'CONFIG_ERROR']).toContain(result.status);
    });
  });
});
