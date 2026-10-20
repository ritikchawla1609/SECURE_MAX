import { deviceStore } from '@/lib/auth/deviceStore';
import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/db/client';
import { MerkleTree } from '@/lib/audit/merkle';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { AuditAnchorABI } from '@/lib/blockchain/abis';
import deployedAddresses from '../../../../../deployed-addresses.json';

export async function GET(req: Request) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  
  if (deviceStore) {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession();
    
    // Only Admin or Auditors can verify
    if (session.role !== 'ADMIN' && session.role !== 'AUDITOR') {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: 'Permission Denied: Must be ADMIN or AUDITOR' }, { status: 403 });
    }

    // 1. Fetch all audit logs (up to 1000 for demo)
    let logs: any[] = [];
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('audit_events')
        .select('event_hash')
        .order('id', { ascending: true })
        .limit(1000);
        
      if (!error && data) {
        logs = data;
      }
    }

    if (logs.length === 0) {
      
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ success: true, message: 'No logs to verify', localRoot: '0x0000000000000000000000000000000000000000000000000000000000000000' });
    }

    // 2. Compute local Merkle Root
    const leaves = logs.map(l => l.event_hash);
    const tree = new MerkleTree(leaves);
    const localRoot = tree.getRoot();

    // 3. Query AuditAnchor on Chain-1
    let onChainRoot = null;
    let verified = false;
    const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/alch_0qnxXuC1AluDumPOynCns';
    const contractAddress = (process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS || (deployedAddresses.contracts as any).AuditAnchor) as `0x${string}`;

    if (contractAddress) {
      try {
        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http(rpcUrl, { timeout: 3000 }),
        });

        const root = await publicClient.readContract({
          address: contractAddress,
          abi: AuditAnchorABI,
          functionName: 'getLatestRoot',
          blockTag: 'latest',
        });
        
        onChainRoot = root;
        // Compare roots
        verified = (localRoot === onChainRoot);
      } catch (err: any) {
        console.warn('Blockchain verification skipped or failed:', err.message);
      }
    }

    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({
      success: true,
      logCount: leaves.length,
      localRoot,
      onChainRoot,
      verified,
      message: verified 
        ? 'Audit logs successfully verified against Chain-1 Anchor.' 
        : (onChainRoot ? 'Tampering detected! Local root does not match on-chain root.' : 'Local root computed. No on-chain root available to compare.')
    });

  } catch (error: any) {
    
    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }
    return NextResponse.json({ error: error.message || 'Failed to verify audit logs' }, { status: 500 });
  }
}
