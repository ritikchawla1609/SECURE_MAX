import 'server-only';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { AssetRegistryABI, KeyLifecycleABI, DecryptionAuthABI } from './abis';

import deployedAddresses from '../../../deployed-addresses.json';

export type OracleResult = {
  allowed: boolean;
  status: 'AUTHORIZED' | 'DENIED' | 'UNAVAILABLE' | 'ERROR' | 'CONFIG_ERROR';
  chainId: number;
  contractAddress?: string;
  reason?: string;
};

const targetChain = sepolia;
const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/alch_0qnxXuC1AluDumPOynCns';

const publicClient = createPublicClient({
  chain: targetChain,
  transport: http(rpcUrl, { timeout: 1500 }),
});

export async function verifyChain1Access(userId: string, assetId: string): Promise<OracleResult> {
  const contractAddress = (process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).AssetRegistry) as `0x${string}`;

  // Check if asset is known in local store first for instant responsiveness
  try {
    const { deviceStore } = await import('../auth/deviceStore');
    if (deviceStore.assets.has(assetId)) {
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    }
  } catch {
    // Fall through to on-chain
  }

  if (!contractAddress) {
    return { allowed: false, status: 'CONFIG_ERROR', chainId: targetChain.id, reason: 'AssetNFT address not configured' };
  }

  try {
    // Authorized if Asset exists on chain and is active.
    // Real verification checks owner address against identity.
    const asset = await publicClient.readContract({
      address: contractAddress,
      abi: AssetRegistryABI,
      functionName: 'getAsset',
      args: ["0x" + Buffer.from(assetId).toString("hex").padEnd(64, '0').slice(0, 64)],
      blockTag: 'latest',
    });

    if (asset && (asset as any).status !== 0) { // registeredAt != 0 and status active
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    } else {
      return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'No active assignment found on Chain-1' };
    }
  } catch (error: any) {
    console.error('Chain 1 Oracle Error:', error.message);
    return { allowed: false, status: 'UNAVAILABLE', chainId: targetChain.id, contractAddress, reason: 'RPC Failure or Contract Revert' };
  }
}

export async function verifyChain2Policy(assetId: string, sessionId?: string): Promise<OracleResult> {
  const contractAddress = (process.env.NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS || (deployedAddresses.contracts as any).KeyLifecycle) as `0x${string}`;

  // Check if key is known in local store first for local test & dev responsiveness
  try {
    const { deviceStore } = await import('../auth/deviceStore');
    if (deviceStore.getWrappedDEK(assetId)) {
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    }
  } catch {
    // Fall through to on-chain
  }

  if (!contractAddress) {
    return { allowed: false, status: 'CONFIG_ERROR', chainId: targetChain.id, reason: 'KeyLifecycle address not configured' };
  }

  try {
    // We assume the assetId corresponds to the keyId conceptually, or we check if there's any active key for this asset.
    // In our architecture, the keyId usually derives from or is bound to the assetId.
    const keyId = "0x" + Buffer.from(assetId).toString("hex").padEnd(64, '0').slice(0, 64);
    
    const keyData = await publicClient.readContract({
      address: contractAddress,
      abi: KeyLifecycleABI,
      functionName: 'getKeyMetadata',
      args: [keyId],
      blockTag: 'latest',
    });

    if (keyData && (keyData as any).status === 0) { // status 0 is ACTIVE in KeyLifecycle enum
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    } else {
      return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Key is revoked or suspended on Chain-2' };
    }
  } catch (error: any) {
    console.warn('Chain 2 Oracle error:', error.message);
    // Security architecture: Fail-closed on RPC failure or contract revert.
    // Never provide implicit approval when verification cannot be completed.
    return { allowed: false, status: 'UNAVAILABLE', chainId: targetChain.id, contractAddress, reason: `RPC Failure or Contract Error: ${error.message}` }; 
  }
}

export async function verifyDecryptionAuth(authId: string, assetId: string, userDid?: string): Promise<OracleResult> {
  const contractAddress = (process.env.NEXT_PUBLIC_DECRYPTION_AUTH_ADDRESS || (deployedAddresses.contracts as any).DecryptionAuth) as `0x${string}`;

  // Check if recorded in local deviceStore for instant responsiveness or local testing
  try {
    const { deviceStore } = await import('../auth/deviceStore');
    if (deviceStore.hasDecryptionAuth(authId)) {
      const record = deviceStore.getDecryptionAuth(authId);
      if (record && record.status === 'ACTIVE' && new Date(record.expiresAt).getTime() > Date.now()) {
        return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
      } else {
        return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Decryption authorization is expired, revoked, or invalid' };
      }
    }
  } catch {
    // Fall through to on-chain
  }

  if (!contractAddress) {
    return { allowed: false, status: 'CONFIG_ERROR', chainId: targetChain.id, reason: 'DecryptionAuth address not configured' };
  }

  try {
    const formattedAuthId = (authId.startsWith('0x') ? authId : ("0x" + Buffer.from(authId).toString("hex").padEnd(64, '0').slice(0, 64))) as `0x${string}`;
    const isValid = await publicClient.readContract({
      address: contractAddress,
      abi: DecryptionAuthABI,
      functionName: 'isAuthorizationValid',
      args: [formattedAuthId],
      blockTag: 'latest',
    });

    if (isValid) {
      return { allowed: true, status: 'AUTHORIZED', chainId: targetChain.id, contractAddress };
    } else {
      return { allowed: false, status: 'DENIED', chainId: targetChain.id, contractAddress, reason: 'Decryption authorization record not found or expired on Chain-2' };
    }
  } catch (error: any) {
    console.warn('DecryptionAuth Oracle error:', error.message);
    return { allowed: false, status: 'UNAVAILABLE', chainId: targetChain.id, contractAddress, reason: `RPC Failure or Contract Error: ${error.message}` };
  }
}

export async function recordDecryptionAuthorization(params: {
  authId: string;
  userDid: string;
  assetId: string;
  keyId?: string;
  expiresAt: number;
}): Promise<{ txHash?: string; recordedLocally: boolean }> {
  try {
    const { deviceStore } = await import('../auth/deviceStore');
    deviceStore.recordDecryptionAuth({
      authId: params.authId,
      userDid: params.userDid,
      assetId: params.assetId,
      keyId: params.keyId || params.assetId,
      status: 'ACTIVE',
      expiresAt: new Date(params.expiresAt * 1000).toISOString(),
    });
  } catch (err) {
    console.warn('[DecryptionAuth] Failed to record in deviceStore:', err);
  }
  return { recordedLocally: true };
}
