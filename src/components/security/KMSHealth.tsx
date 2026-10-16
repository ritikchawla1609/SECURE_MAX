'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Key, Lock, ShieldAlert } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';

export function KMSHealth() {
  const { attackPathStage, activeThreat } = useDemoStore();
  
  const isLocked = attackPathStage === 'BLOCKED' && (activeThreat?.blockedAt === 'KMS' || activeThreat?.blockedAt === 'DOMAIN2');
  
  // Determine KMS status label semantically
  let statusLabel = 'STANDBY';
  let statusColor = 'text-cyan-400 border-cyan-500/30';
  
  if (isLocked) {
    statusLabel = 'DENIED';
    statusColor = 'text-destructive border-destructive/30';
  } else if (attackPathStage === 'DOMAIN2' || attackPathStage === 'KMS') {
    statusLabel = 'EVALUATING';
    statusColor = 'text-amber-400 border-amber-500/30';
  } else if (attackPathStage === 'DECRYPTION') {
    statusLabel = 'AUTHORIZED';
    statusColor = 'text-emerald-400 border-emerald-500/30';
  }

  return (
    <Card className={`bg-[#0a0a0c] border-zinc-800 rounded-lg ${isLocked ? 'border-destructive/50' : ''}`}>
      <CardHeader className="pb-4 pt-6 px-6">
        <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-zinc-400">
          <Key className="w-4 h-4 text-cyan-400" /> Key Management System
        </CardTitle>
        <p className="text-xs text-zinc-600 font-mono mt-1">AES-256-GCM Envelope Encryption</p>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-6">
        
        <div className="flex items-center justify-between p-3 rounded-md bg-black/40 border border-zinc-800">
          <div className="flex items-center gap-3">
            <Lock className={`w-5 h-5 ${isLocked ? 'text-destructive' : 'text-cyan-400'}`} />
            <div>
              <p className="text-sm font-medium leading-none text-zinc-200">Key Policy</p>
              <p className="text-xs text-zinc-600 mt-1 font-mono">Decryption authorization</p>
            </div>
          </div>
          <Badge variant="outline" className={`font-mono text-[10px] ${statusColor}`}>
            {statusLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">Active Policies</p>
            <p className="text-lg font-mono font-medium text-zinc-200">12</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">Active Capabilities</p>
            <p className="text-lg font-mono font-medium text-zinc-200">3</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">Expired Capabilities</p>
            <p className="text-lg font-mono font-medium text-amber-500/80">45</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">Revoked Capabilities</p>
            <p className="text-lg font-mono font-medium text-destructive/80">2</p>
          </div>
        </div>

        {isLocked && (
           <div className="p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-3">
             <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
             <div className="space-y-1">
               <p className="text-xs font-medium text-destructive font-mono tracking-widest">DECRYPTION DENIED</p>
               <p className="text-[10px] text-destructive/80 font-mono">KMS refused to issue temporary decryption capability due to Domain 2 policy rejection.</p>
             </div>
           </div>
        )}

      </CardContent>
    </Card>
  );
}
