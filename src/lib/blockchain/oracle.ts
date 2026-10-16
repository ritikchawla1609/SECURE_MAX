import 'server-only';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { AssetRegistryABI, KeyLifecycleABI } from './abis';

import deployedAddresses from '../../../deployed-addresses.json';

export type OracleResult = {
  allowed: boolean;
  status: 'AUTHORIZED' | 'DENIED' | 'UNAVAILABLE' | 'ERROR' | 'CONFIG_ERROR';
  chainId: number;
  contractAddress?: string;
  reason?: string;
};

const targetChain = sepolia;
const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'http://127.0.0.1:8545';

const publicClient = createPublicClient({
  chain: targetChain,
  transport: http(rpcUrl, { timeout: 1500 }),
});

export async function verifyChain1Access(userId: string, assetId: string): Promise<OracleResult> {
  const contractAddress = (process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).AssetRegistry) as `0x${string}`;

  // 1. Strict user assignment verification (NO implicit grants based solely on local asset existence)
  try {
    const { deviceStore } = await import('../auth/deviceStore');
    const asset = deviceStore.assets.get(assetId);
    if (asset) {
      // Check user assignment in store
      const assignment = deviceStore.getAssignment(userId, assetId);
      if (!assignment) {
        return {
          allowed: false,
          status: 'DENIED',
          chainId: targetChain.id,
          contractAddress,
          reason: 'No active assignment found on Chain-1',
        };
      }
      if (assignment.status === 'EXPIRED' || (assignment.expires_at && new Date(assignment.expires_at).getTime() < Date.now())) {
        return {
          allowed: false,
          status: 'DENIED',
          chainId: targetChain.id,
          contractAddress,
          reason: 'Clearance expired on Chain-1',
        };
      }
      if (assignment.status !== 'ACTIVE' || !assignment.can_decrypt) {
        return {
          allowed: false,
          status: 'DENIED',
          chainId: targetChain.id,
          contractAddress,
          reason: 'No active assignment found on Chain-1',
        };
      }
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    }
  } catch {
    // Fall through to on-chain
  }

  if (!contractAddress) {
    return { allowed: false, status: 'CONFIG_ERROR', chainId: targetChain.id, reason: 'AssetNFT address not configured' };
  }

  try {
    const assetBytes32 = "0x" + Buffer.from(assetId).toString("hex").padEnd(64, '0').slice(0, 64);
    
    // Check on-chain assignment
    let isAllowed = false;
    try {
      const assigned = await publicClient.readContract({
        address: contractAddress,
        abi: AssetRegistryABI,
        functionName: 'isAssigned',
        args: [assetBytes32, userId],
        blockTag: 'latest',
      });
      isAllowed = Boolean(assigned);
    } catch {
      // Fallback: check getAsset
      const asset = await publicClient.readContract({
        address: contractAddress,
        abi: AssetRegistryABI,
        functionName: 'getAsset',
        args: [assetBytes32],
        blockTag: 'latest',
      });
      isAllowed = Boolean(asset && (asset as any).status !== 0 && (asset as any).ownerDid === userId);
    }

    if (isAllowed) {
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    } else {
      return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'No active assignment found on Chain-1' };
    }
  } catch (error: any) {
    console.error('Chain 1 Oracle Error:', error.message);
    // Fail closed on RPC failure
    return { allowed: false, status: 'UNAVAILABLE', chainId: targetChain.id, contractAddress, reason: 'RPC Failure or Contract Revert' };
  }
}

export async function verifyChain2Policy(assetId: string, sessionId?: string): Promise<OracleResult> {
  const contractAddress = (process.env.NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS || (deployedAddresses.contracts as any).KeyLifecycle) as `0x${string}`;

  // 1. Check local key status and session validity
  try {
    const { deviceStore } = await import('../auth/deviceStore');
    const { getKMSProvider } = await import('../kms');
    const provider = getKMSProvider();

    if (await provider.isKeyRevoked(assetId)) {
      return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Key is revoked or suspended on Chain-2' };
    }

    if (sessionId) {
      const session = await deviceStore.getSession(sessionId);
      if (session) {
        if (session.status !== 'ACTIVE') {
          return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Session is revoked on Chain-2' };
        }
        if (new Date(session.expires_at).getTime() < Date.now()) {
          return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Session has expired on Chain-2' };
        }
      }
    }

    const asset = deviceStore.assets.get(assetId);
    if (asset) {
      if (asset.status === 'REVOKED' || asset.status === 'DELETED') {
        return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: `Asset key is ${asset.status} on Chain-2` };
      }
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    }
  } catch {
    // Fall through
  }

  if (!contractAddress) {
    return { allowed: false, status: 'CONFIG_ERROR', chainId: targetChain.id, reason: 'KeyLifecycle address not configured' };
  }

  try {
    const keyId = "0x" + Buffer.from(assetId).toString("hex").padEnd(64, '0').slice(0, 64);
    
    let isKeyActiveOnChain = false;
    try {
      isKeyActiveOnChain = Boolean(
        await publicClient.readContract({
          address: contractAddress,
          abi: KeyLifecycleABI,
          functionName: 'isKeyActive',
          args: [keyId],
          blockTag: 'latest',
        })
      );
    } catch {
      // Fallback: check getKeyMetadata
      const keyData = await publicClient.readContract({
        address: contractAddress,
        abi: KeyLifecycleABI,
        functionName: 'getKeyMetadata',
        args: [keyId],
        blockTag: 'latest',
      });
      const createdAt = keyData ? ((keyData as any).createdAt ?? (keyData as any)[5]) : 0n;
      const status = keyData ? ((keyData as any).status ?? (keyData as any)[3]) : -1;
      isKeyActiveOnChain = Boolean(createdAt && BigInt(createdAt) > 0n && status === 0);
    }

    if (isKeyActiveOnChain) {
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    } else {
      return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Key is revoked, inactive or non-existent on Chain-2' };
    }
  } catch (error: any) {
    console.warn('Chain 2 Oracle Error:', error.message);
    // Fail-closed on dependency failure
    return { allowed: false, status: 'UNAVAILABLE', chainId: targetChain.id, contractAddress, reason: 'Key Management Policy rejected authorization: RPC Failure or Contract Revert' };
  }
}
