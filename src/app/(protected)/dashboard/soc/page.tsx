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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase">SECUREMAX</h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm tracking-widest uppercase">SECURITY OPERATIONS</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4 sm:mt-0">
          <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 px-4 py-1.5 font-mono">
            ETHEREUM SEPOLIA
          </Badge>
          <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 px-4 py-1.5 font-mono uppercase">
            {sessionRole}
          </Badge>
          <Badge variant="outline" className={`px-4 py-1.5 font-mono ${isHealthy ? 'border-emerald-500/50 text-emerald-400' : 'border-destructive/50 text-destructive'}`}>
            ● {isHealthy ? 'OPERATIONAL' : 'EVENT DETECTED'}
          </Badge>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={`bg-[#0a0a0c] border-zinc-800 rounded-lg ${isHealthy ? '' : 'border-red-500/50 '}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Security Posture</CardTitle>
            {postureScore >= 90 ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-2xl font-mono text-zinc-100 ${postureScore >= 90 ? 'text-emerald-500' : 'text-destructive'}`}>
              {postureScore}/100
            </div>
            <p className="text-[10px] font-mono text-zinc-500 mt-1 tracking-widest uppercase">CURRENT SECURITY POSTURE</p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg  ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Active Incidents</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${openIncidentsCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-2xl font-mono text-zinc-100 ${openIncidentsCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {openIncidentsCount}
            </div>
            {openIncidentsCount > 0 ? (
              <div className="mt-1">
                <p className="text-[10px] font-mono text-amber-500 tracking-widest uppercase">TOKEN REPLAY ATTEMPT</p>
                <p className="text-[9px] font-mono text-zinc-500 tracking-widest uppercase mt-0.5">DETECTED · BLOCKED</p>
              </div>
            ) : (
              <p className="text-[10px] font-mono text-zinc-500 mt-1 tracking-widest uppercase">No Active Incidents</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg  ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Threat Shield Health</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-mono text-zinc-100 text-primary ">ACTIVE</div>
            <p className="text-[10px] font-mono text-zinc-500 mt-1 tracking-widest uppercase">5/5 DETERMINISTIC CHECKS</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg  ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Active Sessions</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-mono text-zinc-100 text-foreground">3</div>
            <p className="text-[10px] font-mono text-zinc-500 mt-1 tracking-widest uppercase">AUTHENTICATED SESSIONS</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <InfrastructureHealth />
        <KMSHealth />
      </div>

      <AttackPathVisualization />

      {activeThreat && (
        <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg  border-destructive/50 bg-destructive/10 animate-pulse-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
               <ShieldAlert className="w-5 h-5" /> ACTIVE SECURITY EVENT
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center bg-black/40 p-3 rounded border border-destructive/20">
                <span className="text-sm font-medium">Type</span>
                <span className="text-sm font-mono text-destructive">{activeThreat.name}</span>
              </div>
              <div className="flex justify-between items-center bg-black/40 p-3 rounded border border-destructive/20">
                <span className="text-sm font-medium">Status</span>
                <span className="text-sm font-mono text-amber-500">BLOCKED AT {activeThreat.blockedAt}</span>
              </div>
              <div className="flex justify-between items-center bg-black/40 p-3 rounded border border-destructive/20">
                <span className="text-sm font-medium">Source</span>
                <span className="text-sm font-mono text-muted-foreground">SECURITY TELEMETRY</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SecurityEventTimeline />
    </div>
  );
}
