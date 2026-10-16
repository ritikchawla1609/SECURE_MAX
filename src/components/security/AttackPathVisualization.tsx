'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDemoStore } from '@/stores/useDemoStore';
import { ShieldCheck, ArrowDown, ArrowRight, Key, Lock, Fingerprint, Users, FileLock2, ShieldX, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AttackPathVisualization() {
  const { attackPathStage, activeThreat } = useDemoStore();

  const stages = ['IDENTITY', 'SESSION', 'RBAC', 'DOMAIN1', 'DOMAIN2', 'KMS', 'DECRYPTION'] as const;

  const getStatus = (stage: string) => {
    if (attackPathStage === 'IDLE') return 'ready';  // READY not PENDING
    const currentIndex = stages.indexOf(attackPathStage as any);
    const thisIndex = stages.indexOf(stage as any);
    
    if (attackPathStage === 'BLOCKED') {
      const blockedIndex = stages.indexOf((activeThreat?.blockedAt || 'DOMAIN2') as any);
      if (thisIndex < blockedIndex) return 'passed';
      if (thisIndex === blockedIndex) return 'blocked';
      return 'denied';
    }

    if (thisIndex < currentIndex) return 'passed';
    if (thisIndex === currentIndex) return 'active';
    return 'ready';
  };

  // Gate color logic
  const dom2Status = getStatus('DOMAIN2');
  let gateBorder = 'border-cyan-500/30';
  let gateText = 'text-cyan-400';
  let gateBg = 'bg-cyan-500/5';
  if (attackPathStage === 'BLOCKED' && activeThreat?.blockedAt === 'DOMAIN2') {
    gateBorder = 'border-red-500/50';
    gateText = 'text-red-500';
    gateBg = 'bg-red-500/5';
  } else if (dom2Status === 'passed') {
    gateBorder = 'border-emerald-500/30';
    gateText = 'text-emerald-500';
    gateBg = 'bg-emerald-500/5';
  }

  return (
    <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg overflow-hidden relative">
      <CardHeader className="pb-4 pt-6 px-6 border-b border-zinc-800/50">
        <CardTitle className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          <span>Security Fabric Enforcement</span>
          {attackPathStage === 'BLOCKED' && (
            <Badge variant="outline" className="border-red-500/30 text-red-400 animate-pulse bg-red-500/5 font-mono text-[10px]">THREAT CONTAINED</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-2 max-w-2xl mx-auto">
          
          {/* Top Row: Pre-authorization */}
          <div className="flex items-center gap-2 sm:gap-4 w-full justify-center flex-wrap sm:flex-nowrap">
            <StageBox icon={Fingerprint} label="IDENTITY" desc="AUTHENTICATION" status={getStatus('IDENTITY')} />
            <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${getStatus('IDENTITY') === 'passed' ? 'text-emerald-500' : 'text-zinc-700'}`} />
            <StageBox icon={Server} label="SESSION" desc="CONTEXT" status={getStatus('SESSION')} />
            <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${getStatus('SESSION') === 'passed' ? 'text-emerald-500' : 'text-zinc-700'}`} />
            <StageBox icon={Users} label="RBAC" desc="ROLE EVAL" status={getStatus('RBAC')} />
            <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${getStatus('RBAC') === 'passed' ? 'text-emerald-500' : 'text-zinc-700'}`} />
            <StageBox icon={FileLock2} label="DOMAIN 1" desc="ASSET POLICY" status={getStatus('DOMAIN1')} />
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          {/* SECOND SECURITY GATE */}
          <div className={`w-full max-w-sm border-2 ${gateBorder} ${gateBg} rounded-lg p-4 flex flex-col items-center justify-center relative transition-colors duration-500`}>
            <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase absolute top-2 left-3">Second Security Gate</span>
            <div className={`text-lg font-bold tracking-[0.2em] mt-3 ${gateText}`}>
              AUTHORIZATION ≠ DECRYPTION
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          {/* Bottom Row: Post-authorization cryptography */}
          <div className="flex items-center gap-2 sm:gap-4 w-full justify-center flex-wrap sm:flex-nowrap">
            <StageBox icon={ShieldCheck} label="DOMAIN 2" desc="KEY POLICY" status={getStatus('DOMAIN2')} />
            <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${getStatus('DOMAIN2') === 'passed' ? 'text-emerald-500' : 'text-zinc-700'}`} />
            <StageBox icon={Key} label="KMS" desc="KEY SECURITY" status={getStatus('KMS')} />
            <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${getStatus('KMS') === 'passed' ? 'text-emerald-500' : 'text-zinc-700'}`} />
            <StageBox icon={Lock} label="DECRYPTION" desc="DECISION" status={getStatus('DECRYPTION')} />
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

function StageBox({ icon: Icon, label, desc, status }: { icon: any, label: string, desc?: string, status: string }) {
  const colorClass = () => {
    if (status === 'passed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    if (status === 'active') return 'border-amber-500/50 bg-amber-500/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
    if (status === 'blocked') return 'border-red-500/50 bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
    if (status === 'denied') return 'border-red-500/10 bg-red-500/5 text-red-500/50 opacity-50';
    return 'border-zinc-800 bg-zinc-900/50 text-zinc-500';
  };

  const statusLabel = () => {
    if (status === 'passed') return 'VERIFIED';
    if (status === 'active') return 'EVALUATING';
    if (status === 'blocked') return 'DENIED';
    if (status === 'denied') return 'DENIED';
    return 'READY';
  };

  return (
    <div className={`flex flex-col items-center justify-center w-24 sm:w-28 h-24 rounded-lg border ${colorClass()} transition-all duration-300 relative`}>
      <Icon className="w-5 h-5 mb-1" />
      <span className="text-[10px] font-mono font-medium text-center uppercase tracking-wider">{label}</span>
      {desc && <span className="text-[8px] font-mono text-center uppercase opacity-70 mt-0.5">{desc}</span>}
      <span className={`text-[7px] font-mono tracking-widest mt-1 ${
        status === 'passed' ? 'text-emerald-400' :
        status === 'active' ? 'text-amber-400' :
        status === 'blocked' || status === 'denied' ? 'text-red-400' :
        'text-zinc-600'
      }`}>
        {statusLabel()}
      </span>
      {status === 'blocked' && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
          <ShieldX className="w-2 h-2 text-white" />
        </div>
      )}
    </div>
  );
}
