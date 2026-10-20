import { describe, it, expect, beforeAll, vi } from 'vitest';
import { verifyChain1Access, verifyChain2Policy } from '../../src/lib/blockchain/oracle';
import { keccak256, toHex, stringToHex, createWalletClient, http, publicActions, createPublicClient } from 'viem';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';

vi.mock('server-only', () => ({}));

describe('[LOCAL BLOCKCHAIN INTEGRATION TEST] Oracle & Dual-Chain Execution', () => {
  let assetRegistryAddress: `0x${string}`;
  let keyLifecycleAddress: `0x${string}`;
  
  const publicClient = createPublicClient({ chain: hardhat, transport: http('http://127.0.0.1:8545') });
  const walletClient = createWalletClient({ chain: hardhat, transport: http('http://127.0.0.1:8545') }).extend(publicActions);

  beforeAll(async () => {
    // We assume a hardhat node is running and deploy script has been run
    // For this test, we read the deployed addresses. If they don't exist, we skip.
    try {
      const addressesPath = path.join(process.cwd(), 'deployed-addresses.json');
      if (fs.existsSync(addressesPath)) {
        const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
        assetRegistryAddress = addresses.chain1.AssetRegistry;
        keyLifecycleAddress = addresses.chain2.KeyLifecycle;
        
        process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS = assetRegistryAddress;
        process.env.NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS = keyLifecycleAddress;
        process.env.NEXT_PUBLIC_CHAIN_RPC_URL = 'http://127.0.0.1:8545';
        process.env.NODE_ENV = 'test';
        
        // Ensure the node is actually running
        try {
          await publicClient.getBlockNumber();
        } catch {
          console.warn('Hardhat node is not running. Skipping integration tests.');
          assetRegistryAddress = undefined as any;
        }
      } else {
        console.warn('deployed-addresses.json not found. Make sure hardhat node is running and scripts/deploy.ts was executed.');
      }
    } catch (e) {
      console.error(e);
    }
  });

  it('Oracle should strictly return DENIED if asset is not assigned on Chain-1', async () => {
    if (!assetRegistryAddress) return; // Skip if no local chain
    const result = await verifyChain1Access('did:test:user', 'unassigned-asset');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('DENIED');
  });

  // Note: Since we are not dynamically compiling and deploying in Vitest, 
  // these tests just prove that the oracle fails closed against an empty/unseeded contract.
  // The full E2E requires the UI flow.
});
