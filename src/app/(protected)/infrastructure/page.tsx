'use client';

import * as React from 'react';
import { Server, Activity, Clock, Box, ShieldCheck, ChevronDown } from 'lucide-react';
import { useBlockNumber, usePublicClient } from 'wagmi';

import deployedAddresses from '../../../../deployed-addresses.json';

const CONTRACTS = [
  { name: 'IdentityRegistry', address: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).IdentityRegistry, domain: 'Chain-1: Identity & Access' },
  { name: 'RBACManager', address: process.env.NEXT_PUBLIC_RBAC_MANAGER_ADDRESS || (deployedAddresses.contracts as any).RBACManager, domain: 'Chain-1: Identity & Access' },
  { name: 'AssetRegistry', address: process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS || (deployedAddresses.contracts as any).AssetRegistry, domain: 'Chain-1: Identity & Access' },
  { name: 'AuditAnchor', address: process.env.NEXT_PUBLIC_AUDIT_ANCHOR_ADDRESS || (deployedAddresses.contracts as any).AuditAnchor, domain: 'Chain-1: Identity & Access' },
  { name: 'KeyPolicyManager', address: process.env.NEXT_PUBLIC_KEY_POLICY_MANAGER_ADDRESS || (deployedAddresses.contracts as any).KeyPolicyManager, domain: 'Chain-2: Key Management' },
  { name: 'KeyLifecycle', address: process.env.NEXT_PUBLIC_KEY_LIFECYCLE_ADDRESS || (deployedAddresses.contracts as any).KeyLifecycle, domain: 'Chain-2: Key Management' },
  { name: 'DecryptionAuth', address: process.env.NEXT_PUBLIC_DECRYPTION_AUTH_ADDRESS || (deployedAddresses.contracts as any).DecryptionAuth, domain: 'Chain-2: Key Management' }
];

export default function InfrastructurePage() {
  const { data: blockNumber, isError } = useBlockNumber({ watch: true });
  const client = usePublicClient();
  const [bytecodeStatus, setBytecodeStatus] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<string | null>(null);
  
  const chainId = client?.chain?.id;
  const isHealthy = !isError && chainId === 11155111;

  React.useEffect(() => {
    if (!client || chainId !== 11155111) return;
    const checkBytecode = async () => {
      const statuses: Record<string, boolean> = {};
      for (const contract of CONTRACTS) {
        try {
          const code = await client.getBytecode({ address: contract.address as `0x${string}` });
          statuses[contract.name] = code !== undefined && code !== '0x';
        } catch {
          statuses[contract.name] = false;
        }
      }
      setBytecodeStatus(statuses);
    };
    checkBytecode();
  }, [client, chainId]);

  return (
    <div className="space-y-8 font-sans selection:bg-cyan-500/30 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100 uppercase flex items-center gap-3">
          <Server className="h-6 w-6 text-cyan-400" />
          Blockchain Infrastructure
        </h2>
        <p className="text-sm text-zinc-500 font-mono tracking-widest mt-1 uppercase">Distributed Security Enforcement</p>
      </div>

      <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-6">
        <h3 className="text-[10px] font-mono tracking-widest text-zinc-500 mb-6 uppercase border-b border-zinc-800 pb-2">Network Connection</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-[10px] font-mono text-zinc-500 mb-1">NETWORK</div>
            <div className="text-lg font-mono text-cyan-400">ETHEREUM SEPOLIA</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-zinc-500 mb-1">CHAIN ID</div>
            <div className="text-lg font-mono text-zinc-100">{chainId || '---'}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-zinc-500 mb-1">BLOCK HEIGHT</div>
            <div className="text-lg font-mono text-zinc-100">{blockNumber ? blockNumber.toString() : '---'}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-zinc-500 mb-1">RPC STATUS</div>
            <div className={`text-lg font-mono flex items-center gap-2 ${isHealthy ? 'text-emerald-500' : 'text-red-500'}`}>
              {isHealthy ? <><Activity className="w-4 h-4 animate-pulse"/> ONLINE</> : 'OFFLINE'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
           <h3 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Deployed Contracts</h3>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {CONTRACTS.map((contract) => {
            const hasBytecode = bytecodeStatus[contract.name];
            const isOk = isHealthy && hasBytecode;
            const isExp = expanded === contract.name;

            return (
              <div key={contract.name} className="bg-[#0a0a0c] hover:bg-zinc-900/50 transition-colors">
                <div 
                  className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer gap-4"
                  onClick={() => setExpanded(isExp ? null : contract.name)}
                >
                  <div className="flex items-center gap-4">
                    <Box className="w-5 h-5 text-zinc-600" />
                    <div>
                      <div className="text-sm font-bold tracking-widest text-zinc-100 uppercase">{contract.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{contract.domain}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-mono text-zinc-500">STATUS</span>
                       <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isOk ? 'bg-emerald-500/10 text-emerald-500' : hasBytecode === false ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-400'}`}>
                         {isOk ? 'ONLINE' : hasBytecode === false ? 'NOT DEPLOYED' : 'CHECKING...'}
                       </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-mono text-zinc-500">BYTECODE</span>
                       <span className={`text-[10px] font-mono ${isOk ? 'text-emerald-500' : 'text-zinc-500'}`}>
                         {isOk ? 'PRESENT' : '---'}
                       </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-mono text-zinc-500">READ</span>
                       <span className={`text-[10px] font-mono ${isOk ? 'text-emerald-500' : 'text-zinc-500'}`}>
                         {isOk ? 'OK' : '---'}
                       </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {isExp && (
                  <div className="p-4 bg-zinc-950/50 border-t border-zinc-800/50 flex flex-col gap-2">
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Contract Address</div>
                    <div className="font-mono text-xs text-cyan-400 bg-black/40 p-3 rounded border border-zinc-800 break-all select-all">
                      {contract.address}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
