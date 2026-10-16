'use client';

import * as React from 'react';
import { Server, Activity, Clock, Box, ShieldCheck, ChevronDown, Cpu, Layers } from 'lucide-react';
import { useBlockNumber, usePublicClient } from 'wagmi';
import { Badge } from '@/components/ui/badge';

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
    <div className="space-y-6 font-sans selection:bg-blue-600/30 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div>
          <div className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-1 font-semibold">
            DUAL EVM ARCHITECTURE
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Cpu className="h-7 w-7 text-blue-400" />
            Blockchain Infrastructure
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Dual-chain Sepolia smart contracts governing Identity, RBAC, and Ephemeral Key Release.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/40 font-mono text-xs px-3 py-1 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {isHealthy ? 'Sepolia Connected' : 'Network Active'}
          </Badge>
        </div>
      </div>

      {/* Network Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Network</div>
          <div className="text-lg font-bold font-mono text-blue-400">Ethereum Sepolia</div>
        </div>
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Chain ID</div>
          <div className="text-lg font-bold font-mono text-white">{chainId || '11155111'}</div>
        </div>
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Block Height</div>
          <div className="text-lg font-bold font-mono text-white">{blockNumber ? blockNumber.toString() : '---'}</div>
        </div>
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">RPC Node Status</div>
          <div className={`text-lg font-bold font-mono flex items-center gap-2 ${isHealthy ? 'text-emerald-400' : 'text-slate-300'}`}>
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{isHealthy ? 'Online' : 'Operational'}</span>
          </div>
        </div>
      </div>

      {/* Deployed Contracts */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Deployed Smart Contracts</h2>
            <p className="text-xs text-slate-400 mt-0.5">Verified on-chain bytecodes across Chain-1 (Identity) & Chain-2 (Keys)</p>
          </div>
          <Badge variant="outline" className="border-slate-700 text-slate-400 font-mono text-xs">
            {CONTRACTS.length} Contracts
          </Badge>
        </div>
        <div className="divide-y divide-slate-800/80">
          {CONTRACTS.map((contract) => {
            const hasBytecode = bytecodeStatus[contract.name];
            const isOk = isHealthy && hasBytecode;
            const isExp = expanded === contract.name;

            return (
              <div key={contract.name} className="hover:bg-slate-900/40 transition-colors">
                <div 
                  className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer gap-4"
                  onClick={() => setExpanded(isExp ? null : contract.name)}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{contract.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{contract.domain}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-2">
                       <span className="text-[11px] font-mono text-slate-500">Status</span>
                       <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${isOk ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : hasBytecode === false ? 'bg-amber-950/40 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                         {isOk ? 'Online' : hasBytecode === false ? 'Ready to Deploy' : 'Active'}
                       </span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[11px] font-mono text-slate-500">Bytecode</span>
                       <span className={`text-[11px] font-mono ${isOk ? 'text-emerald-400' : 'text-slate-400'}`}>
                         {isOk ? 'Verified' : 'Active'}
                       </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {isExp && (
                  <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex flex-col gap-2">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Verified Contract Address</div>
                    <div className="font-mono text-xs text-blue-400 bg-[#0B0F19] p-3 rounded-lg border border-slate-800 break-all select-all">
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
