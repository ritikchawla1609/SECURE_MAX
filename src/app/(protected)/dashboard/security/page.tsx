'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, ShieldAlert, ShieldCheck, Activity, Loader2, Play } from 'lucide-react';
import { runSecurityScanAction, fetchSecurityPosture } from '@/app/actions/sentinel';
import { Badge } from '@/components/ui/badge';

export default function SecurityCenterPage() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<{ scans: any[]; findings: any[]; incidents: any[] }>({ scans: [], findings: [], incidents: [] });
  const [sessionRole, setSessionRole] = useState('LOADING...');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const posture = await fetchSecurityPosture();
      setData(posture);
    } catch (err: any) {
      setErrorMsg('Failed to load security posture. Ensure you have the correct privileges.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(authData => {
        if (authData?.session?.role) {
          setSessionRole(authData.session.role);
        } else {
          setSessionRole('UNKNOWN');
        }
      })
      .catch(() => setSessionRole('UNKNOWN'));

    loadData();
  }, []);

  const handleRunScan = async () => {
    setScanning(true);
    setErrorMsg(null);
    try {
      const res = await runSecurityScanAction('admin-dashboard');
      if (res.success) {
        await loadData();
      } else {
        setErrorMsg(res.error || 'Scan failed to execute');
      }
    } catch (err: any) {
      setErrorMsg('Network or server error during scan execution.');
    }
    setScanning(false);
  };

  const lastScan = data.scans[0];
  const isHealthy = data.incidents.length === 0 && data.findings.filter(f => f.status === 'OPEN').length === 0;

  return (
    <div className="space-y-6 font-sans selection:bg-blue-600/30 pb-12 animate-in fade-in duration-300">
      {errorMsg && (
        <div className="bg-red-950/40 border border-red-500/40 text-red-300 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
          <span className="text-xs font-mono">{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg(null)} className="h-6 w-6 p-0 text-slate-400 hover:text-white">
            <span className="sr-only">Close</span>✕
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div>
          <div className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-1 font-semibold">
            SENTINEL ATTACK ENGINE
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-blue-400" />
            Security Posture
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Automated deterministic sandbox vulnerability scans and continuous policy enforcement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/40 font-mono text-xs px-3 py-1.5">
            Role: {sessionRole}
          </Badge>
          <Button 
            onClick={handleRunScan} 
            disabled={scanning} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 flex items-center gap-2 shadow-sm font-sans"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{scanning ? 'Running Sandbox Scan...' : 'Run Security Scan'}</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Posture Status</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              {isHealthy ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-red-400" />}
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
            {isHealthy ? 'SECURE' : 'ACTION REQ'}
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">Deterministic Verification</p>
        </div>
        
        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Open Incidents</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
            {data.incidents.length}
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">Active Investigations</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Scan Checks Passed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            {lastScan?.passed_count || 0}
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">Verified Invariants</p>
        </div>

        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Scan Checks Failed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {lastScan?.failed_count || 0}
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-2">Zero Critical Exploits</p>
        </div>
      </div>

      {/* Findings & History Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Recent Security Findings</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Sandbox-detected vulnerabilities requiring verification</p>
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-400" /></div>
            ) : data.findings.length > 0 ? (
              <div className="space-y-3">
                {data.findings.map(finding => (
                  <div key={finding.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-200">{finding.description.split('-')[0]}</p>
                      <p className="text-[10px] font-mono text-slate-400">{new Date(finding.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant={finding.severity === 'CRITICAL' ? 'destructive' : 'outline'} className={finding.severity !== 'CRITICAL' ? "border-amber-500/40 text-amber-400 bg-amber-950/30 font-mono text-[10px] shrink-0" : "font-mono text-[10px] shrink-0"}>
                      {finding.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                 <ShieldCheck className="w-10 h-10 text-emerald-400/60 mb-2" />
                 <p className="text-xs font-medium text-emerald-400">Zero Active Findings</p>
                 <p className="text-[11px] text-slate-500 mt-1">All fail-closed security properties intact.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span>Scan History</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Execution telemetry of the Sentinel engine</p>
            </div>
          </div>
          <div className="p-5">
             {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-400" /></div>
            ) : data.scans.length > 0 ? (
              <div className="space-y-3">
                {data.scans.map(scan => (
                  <div key={scan.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-200">Automated Sandbox Scan</p>
                      <p className="text-[10px] font-mono text-slate-400">{new Date(scan.started_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] font-mono flex items-center gap-2">
                        <span className="text-emerald-400 font-medium">Passed: {scan.passed_count}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-red-400 font-medium">Failed: {scan.failed_count}</span>
                      </div>
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-950/40 font-mono text-[10px]">
                        {scan.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-12">No scan history recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
