'use client';

import * as React from 'react';
import { 
  FolderLock, 
  ShieldCheck, 
  Clock, 
  ShieldAlert, 
  HardDrive, 
  Smartphone, 
  Activity,
  FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VaultOverviewProps {
  totalAssets: number;
  authorizedCount: number;
  pendingCount: number;
  restrictedCount: number;
  storageUsedBytes: number;
  storageMaxBytes: number;
  recentActivity: Array<{
    id: string;
    assetName: string;
    action: string;
    timeAgo: string;
    status: 'SUCCESS' | 'DENIED' | 'PENDING';
  }>;
  activeDeviceName?: string;
}

export function VaultOverviewCard({
  totalAssets,
  authorizedCount,
  pendingCount,
  restrictedCount,
  storageUsedBytes,
  storageMaxBytes,
  recentActivity,
  activeDeviceName = 'Enrolled Hardware Terminal',
}: VaultOverviewProps) {
  const usedMB = (storageUsedBytes / (1024 * 1024)).toFixed(1);
  const maxMB = (storageMaxBytes / (1024 * 1024)).toFixed(0);
  const percentUsed = Math.min(100, Math.round((storageUsedBytes / storageMaxBytes) * 100));

  return (
    <div className="space-y-4">
      {/* 4-Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#0a0a0c] border-zinc-800/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Total Assets</span>
            <FolderLock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-100">{totalAssets}</span>
            <span className="text-[10px] text-zinc-500 font-mono">Encrypted</span>
          </div>
        </Card>

        <Card className="bg-[#0a0a0c] border-zinc-800/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Authorized</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">{authorizedCount}</span>
            <span className="text-[10px] text-emerald-500/80 font-mono">Full Decrypt</span>
          </div>
        </Card>

        <Card className="bg-[#0a0a0c] border-zinc-800/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">{pendingCount}</span>
            <span className="text-[10px] text-amber-500/80 font-mono">NFT Permit</span>
          </div>
        </Card>

        <Card className="bg-[#0a0a0c] border-zinc-800/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Restricted</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400">{restrictedCount}</span>
            <span className="text-[10px] text-rose-500/80 font-mono">KMS Refused</span>
          </div>
        </Card>
      </div>

      {/* Secondary Bar: Storage Progress & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        
        {/* Storage Bar Card */}
        <Card className="bg-[#0a0a0c] border-zinc-800/80 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mb-2">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Vault Storage Allocation
              </span>
              <span className="text-zinc-300 font-bold">{usedMB} MB / {maxMB} MB</span>
            </div>
            {/* Progress Track */}
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500" 
                style={{ width: `${Math.max(5, percentUsed)}%` }} 
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-zinc-500">
              <span>AES-256-GCM Encrypted Blob Storage</span>
              <span>{percentUsed}% Utilized</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" /> Bound Device:
            </span>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 text-[10px] bg-cyan-950/20">
              {activeDeviceName}
            </Badge>
          </div>
        </Card>

        {/* Recent Activity Card */}
        <Card className="lg:col-span-2 bg-[#0a0a0c] border-zinc-800/80 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Recent Vault Activity
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Real-Time Cryptographic Ledger</span>
          </div>

          <div className="space-y-2 mt-2">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 3).map((act) => (
                <div 
                  key={act.id} 
                  className="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/50 text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-zinc-200 font-medium truncate">{act.assetName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge 
                      className={`text-[9px] font-mono ${
                        act.status === 'SUCCESS' 
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' 
                          : act.status === 'DENIED' 
                          ? 'border-rose-500/30 text-rose-400 bg-rose-950/20' 
                          : 'border-amber-500/30 text-amber-400 bg-amber-950/20'
                      }`}
                    >
                      {act.action}
                    </Badge>
                    <span className="text-[10px] text-zinc-500">{act.timeAgo}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs font-mono text-zinc-500 py-3 text-center">
                No recent activity recorded.
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
