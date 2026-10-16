'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';

export function InfrastructureHealth() {
  const { systemState, activeThreat, attackPathStage } = useDemoStore();
  const hasThreat = !!activeThreat;
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.session?.role) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {});
  }, []);

  const stages = ['IDENTITY', 'SESSION', 'RBAC', 'DOMAIN1', 'DOMAIN2', 'KMS', 'DECRYPTION'] as const;
  
  const isPastStage = (stage: string): boolean => {
    if (attackPathStage === 'IDLE') return false;
    const stageIdx = stages.indexOf(stage as any);
    const currentIdx = stages.indexOf(attackPathStage as any);
    if (attackPathStage === 'BLOCKED') {
      const blockedIdx = stages.indexOf((activeThreat?.blockedAt || 'DOMAIN2') as any);
      return stageIdx < blockedIdx;
    }
    return stageIdx < currentIdx || stageIdx === currentIdx;
  };

  const isBlockedAt = (stage: string): boolean => {
    return attackPathStage === 'BLOCKED' && activeThreat?.blockedAt === stage;
  };

  // IDENTITY state: READY if not authenticated, VERIFIED if authenticated
  const identityState = isAuthenticated ? 'VERIFIED' : 'READY';
  const identityColor = isAuthenticated ? 'text-emerald-500' : 'text-cyan-400';

  // DOMAIN 1: READY (idle) → HEALTHY (past) → DENIED (blocked)
  let domain1State = 'READY';
  let domain1Color = 'text-cyan-400';
  if (isBlockedAt('DOMAIN1')) { domain1State = 'DENIED'; domain1Color = 'text-red-500'; }
  else if (isPastStage('DOMAIN1')) { domain1State = 'HEALTHY'; domain1Color = 'text-emerald-500'; }

  // DOMAIN 2: READY (idle) → HEALTHY (past) → DENIED (blocked)
  let domain2State = 'READY';
  let domain2Color = 'text-cyan-400';
  if (isBlockedAt('DOMAIN2')) { domain2State = 'DENIED'; domain2Color = 'text-red-500'; }
  else if (isPastStage('DOMAIN2')) { domain2State = 'HEALTHY'; domain2Color = 'text-emerald-500'; }

  // KMS: PROTECTED (idle) → AUTHORIZED (past) → LOCKED (blocked)
  let kmsState = 'PROTECTED';
  let kmsColor = 'text-cyan-400';
  if (isBlockedAt('KMS') || (attackPathStage === 'BLOCKED' && (activeThreat?.blockedAt === 'DOMAIN2' || activeThreat?.blockedAt === 'KMS'))) {
    kmsState = 'LOCKED'; kmsColor = 'text-red-500';
  } else if (isPastStage('KMS')) {
    kmsState = 'AUTHORIZED'; kmsColor = 'text-emerald-500';
  }

  // SENTINEL: ACTIVE normally, DETECTED during threat
  const sentinelState = hasThreat ? 'DETECTED' : 'ACTIVE';
  const sentinelColor = hasThreat ? 'text-amber-500' : 'text-emerald-500';

  const rows = [
    { label: 'IDENTITY', state: identityState, color: identityColor },
    { label: 'DOMAIN 1', state: domain1State, color: domain1Color },
    { label: 'DOMAIN 2', state: domain2State, color: domain2Color },
    { label: 'KMS', state: kmsState, color: kmsColor },
    { label: 'THREAT SHIELD', state: sentinelState, color: sentinelColor },
    { label: 'AUDIT', state: 'VERIFIED', color: 'text-emerald-500' },
  ];

  return (
    <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg">
      <CardHeader className="pb-4 pt-6 px-6">
        <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-zinc-400">
          <Server className="w-4 h-4 text-cyan-400" /> Security Posture
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        
        {rows.map(row => (
          <div key={row.label} className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
            <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">{row.label}</span>
            <span className={`${row.color} font-mono text-xs tracking-widest flex items-center gap-2`}>● {row.state}</span>
          </div>
        ))}

        {hasThreat && (
          <>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
              <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">ACCESS</span>
              <span className="text-red-500 font-mono text-xs tracking-widest flex items-center gap-2">● BLOCKED</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-red-500 font-mono text-xs uppercase tracking-widest">INCIDENT</span>
              <span className="text-red-500 font-mono text-xs tracking-widest flex items-center gap-2 animate-pulse">● ACTIVE</span>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}
