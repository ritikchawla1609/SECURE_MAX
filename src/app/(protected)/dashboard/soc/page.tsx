'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, Activity, Server, Key, Lock, AlertTriangle } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';
import { InfrastructureHealth } from '@/components/blockchain/InfrastructureHealth';
import { KMSHealth } from '@/components/security/KMSHealth';
import { AttackPathVisualization } from '@/components/security/AttackPathVisualization';
import { SecurityEventTimeline } from '@/components/dashboard/SecurityEventTimeline';

export default function SOCDashboard() {
  const { systemState, postureScore, incidents, activeThreat } = useDemoStore();
  const [sessionRole, setSessionRole] = React.useState('LOADING...');

  React.useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.session?.role) {
          setSessionRole(data.session.role);
        } else {
          setSessionRole('UNKNOWN');
        }
      })
      .catch(() => setSessionRole('UNKNOWN'));
  }, []);

  const isHealthy = systemState === 'NORMAL' || systemState === 'RECOVERED';
  const openIncidentsCount = incidents.filter(i => i.status !== 'THREAT CONTAINED').length;

  return (
    <div className="space-y-6 font-sans selection:bg-blue-600/30 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div>
          <div className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-1 font-semibold">
            CYBER COMMAND & OPERATIONS
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Server className="h-7 w-7 text-blue-400" />
            SOC Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Real-time security operations telemetry, node health, KMS state, and live attack path tracing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/40 font-mono text-xs px-3 py-1">
            Sepolia Dual-Chain
          </Badge>
          <Badge variant="outline" className={`font-mono text-xs px-3 py-1 ${isHealthy ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/40' : 'border-red-500/40 text-red-400 bg-red-950/40'}`}>
            ● {isHealthy ? 'Operational' : 'Event Detected'}
          </Badge>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`p-5 rounded-xl bg-[#0F172A] border ${isHealthy ? 'border-slate-800' : 'border-red-500/40'} shadow-sm`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Security Posture</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              {postureScore >= 90 ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-red-400" />}
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight ${postureScore >= 90 ? 'text-emerald-400' : 'text-red-400'}`}>
            {postureScore}/100
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">Active Sentinel Assurance</p>
        </div>
        
        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Active Incidents</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <AlertTriangle className={`h-4 w-4 ${openIncidentsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight ${openIncidentsCount > 0 ? 'text-amber-400' : 'text-white'}`}>
            {openIncidentsCount}
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">
            {openIncidentsCount > 0 ? 'Threat under investigation' : 'Zero uncontained threats'}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Threat Shield Health</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">Active</div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">5/5 Deterministic Checks</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">KMS Key Lifecycle</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Lock className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">Healthy</div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">Zeroization & Memory Shield</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <InfrastructureHealth />
        <KMSHealth />
      </div>

      <AttackPathVisualization />

      {activeThreat && (
        <div className="p-5 rounded-xl bg-[#0F172A] border border-red-500/50 shadow-sm">
          <div className="flex items-center gap-2 text-red-400 font-bold mb-3 text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>Active Security Event Detected</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400">Threat Vector</div>
              <div className="text-xs font-bold text-red-300 font-mono mt-0.5">{activeThreat.name}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400">Defense Boundary</div>
              <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">Blocked at {activeThreat.blockedAt}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-400">Telemetry Feed</div>
              <div className="text-xs font-bold text-blue-400 font-mono mt-0.5">Automated SOC Containment</div>
            </div>
          </div>
        </div>
      )}

      <SecurityEventTimeline />
    </div>
  );
}
