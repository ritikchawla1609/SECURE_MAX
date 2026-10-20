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
      // Real deterministic check execution
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md flex items-center justify-between mb-4">
          <span className="text-sm font-medium">{errorMsg}</span>
          <Button variant="ghost" size="sm" onClick={() => setErrorMsg(null)} className="h-6 w-6 p-0"><span className="sr-only">Close</span>✕</Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Security Center</h2>
          <p className="text-muted-foreground mt-1">Continuous Security &amp; Policy Enforcement Engine</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4 sm:mt-0">
          <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 px-4 py-1.5 font-mono">
            ROLE: {sessionRole}
          </Badge>
          <Button onClick={handleRunScan} disabled={scanning} className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono">
            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
            {scanning ? 'EXECUTING...' : 'RUN SANDBOX SCAN'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className=" ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Posture Status</CardTitle>
            {isHealthy ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${isHealthy ? 'text-emerald-500' : 'text-destructive'}`}>{isHealthy ? 'SECURE' : 'ACTION REQ'}</div>
            <p className="text-xs text-muted-foreground mt-1">Deterministic state</p>
          </CardContent>
        </Card>
        
        <Card className=" ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Incidents</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-500">{data.incidents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active investigations</p>
          </CardContent>
        </Card>

        <Card className=" ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scan Checks Passed</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary ">{lastScan?.passed_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully mitigated</p>
          </CardContent>
        </Card>

        <Card className={` ${lastScan?.failed_count > 0 ? 'border-destructive/50' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scan Checks Failed</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">{lastScan?.failed_count || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Vulnerabilities detected</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className=" border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" /> Recent Findings
            </CardTitle>
            <CardDescription>Sandbox-detected vulnerabilities requiring remediation.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : data.findings.length > 0 ? (
              <div className="space-y-3">
                {data.findings.map(finding => (
                  <div key={finding.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-black/40 border border-zinc-800 hover:border-zinc-800 transition-colors gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-tight">{finding.description.split('-')[0]}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{new Date(finding.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant={finding.severity === 'CRITICAL' ? 'destructive' : 'outline'} className={finding.severity !== 'CRITICAL' ? "border-amber-500/50 text-amber-500 font-mono text-[10px] shrink-0" : "font-mono text-[10px] shrink-0"}>
                      {finding.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
                 <ShieldCheck className="w-12 h-12 text-emerald-500/50 mb-4" />
                 <p className="text-sm text-emerald-400">Zero active findings.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className=" border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Activity className="w-5 h-5 text-primary" /> Scan History
            </CardTitle>
            <CardDescription>Execution telemetry of the Security engine.</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : data.scans.length > 0 ? (
              <div className="space-y-3">
                {data.scans.map(scan => (
                  <div key={scan.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-black/40 border border-zinc-800 hover:border-zinc-800 transition-colors gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Automated Sandbox Scan</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{new Date(scan.started_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-[10px] font-mono flex items-center gap-3">
                        <span className="text-emerald-400">P:{scan.passed_count}</span>
                        <span className="text-destructive">F:{scan.failed_count}</span>
                      </div>
                      <Badge variant="outline" className={scan.status === 'COMPLETED' ? 'border-primary/30 text-primary font-mono text-[10px]' : 'font-mono text-[10px]'}>
                        {scan.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No scan history available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
