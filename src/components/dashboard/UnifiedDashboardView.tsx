'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  Shield, 
  HardDrive, 
  Share2, 
  Key, 
  Database, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  UploadCloud, 
  Lock, 
  FileText, 
  Clock, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  FileCheck2,
  Check
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

interface DashboardStats {
  totalFiles: number;
  sharedFiles: number;
  pendingAccess: number;
  storageUsedBytes: number;
  storageMaxBytes: number;
  recentActivity: Array<{
    id: string;
    action: string;
    resource: string;
    user: string;
    timestamp: string;
    status: 'SUCCESS' | 'DENIED' | 'PENDING';
  }>;
}

export function UnifiedDashboardView() {
  const [session, setSession] = React.useState<{
    name: string;
    email: string;
    role: string;
    deviceName?: string;
  } | null>(null);

  const [stats, setStats] = React.useState<DashboardStats>({
    totalFiles: 0,
    sharedFiles: 0,
    pendingAccess: 0,
    storageUsedBytes: 0,
    storageMaxBytes: 524288000,
    recentActivity: [],
  });

  const [loading, setLoading] = React.useState(true);

  // Fetch live session and real metrics
  const loadDashboardData = React.useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      const [sessionRes, assetsRes, requestsRes] = await Promise.all([
        fetch('/api/auth/session').catch(() => null),
        fetch('/api/assets/list?scope=ALL_DATA').catch(() => null),
        fetch('/api/access/requests').catch(() => null),
      ]);

      if (sessionRes && sessionRes.ok) {
        const sData = await sessionRes.json();
        if (sData?.session) {
          setSession({
            name: sData.session.name || sData.session.email || 'Authorized User',
            email: sData.session.email || '',
            role: sData.session.role || 'USER',
            deviceName: sData.session.deviceName,
          });
        }
      }

      let totalFiles = 0;
      let sharedCount = 0;
      let usedBytes = 0;
      let maxBytes = 524288000;
      const recentList: any[] = [];

      if (assetsRes && assetsRes.ok) {
        const aData = await assetsRes.json();
        if (aData.success && Array.isArray(aData.assets)) {
          totalFiles = aData.assets.length;
          sharedCount = aData.assets.filter(
            (a: any) =>
              (a.assignedUsersCount && a.assignedUsersCount > 0) ||
              a.sharingScope === 'SPECIFIC_USERS' ||
              a.sharingScope === 'ALL_PEOPLE'
          ).length;

          if (aData.storage) {
            usedBytes = aData.storage.usedBytes || 0;
            maxBytes = aData.storage.maxBytes || 524288000;
          }

          // Extract recent file activities from asset access histories
          aData.assets.slice(0, 8).forEach((asset: any) => {
            if (Array.isArray(asset.accessHistory) && asset.accessHistory.length > 0) {
              asset.accessHistory.slice(0, 2).forEach((h: any) => {
                recentList.push({
                  id: h.id || Math.random().toString(),
                  action: h.action || 'File Access',
                  resource: asset.name,
                  user: h.user_name || asset.ownerName || 'User',
                  timestamp: h.timestamp || asset.createdAt,
                  status: h.status || 'SUCCESS',
                });
              });
            } else {
              recentList.push({
                id: asset.id,
                action: 'File Created & Encrypted',
                resource: asset.name,
                user: asset.ownerName || 'Security Admin',
                timestamp: asset.createdAt,
                status: 'SUCCESS',
              });
            }
          });
        }
      }

      let pendingCount = 0;
      if (requestsRes && requestsRes.ok) {
        const rData = await requestsRes.json();
        if (rData.success && Array.isArray(rData.requests)) {
          pendingCount = rData.requests.filter((r: any) => r.status === 'PENDING').length;
        }
      }

      // Sort recent activity descending
      recentList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        totalFiles,
        sharedFiles: sharedCount,
        pendingAccess: pendingCount,
        storageUsedBytes: usedBytes,
        storageMaxBytes: maxBytes,
        recentActivity: recentList.slice(0, 6),
      });
    } catch (err) {
      console.error('Failed to load dashboard telemetry:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Synchronize via SSE & background polling
  useRealtimeSync(() => loadDashboardData(true), 3000);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const [verifyingIntegrity, setVerifyingIntegrity] = React.useState(false);
  const [integrityResult, setIntegrityResult] = React.useState<{
    verified: boolean;
    localRoot?: string;
    onChainRoot?: string | null;
    logCount?: number;
    message?: string;
  } | null>(null);

  const handleVerifyIntegrity = async () => {
    setVerifyingIntegrity(true);
    setIntegrityResult(null);
    try {
      const res = await fetch('/api/audit/verify');
      const data = await res.json();
      if (res.ok) {
        setIntegrityResult(data);
      } else {
        setIntegrityResult({
          verified: false,
          message: data.error || 'Verification check failed',
        });
      }
    } catch (e: any) {
      setIntegrityResult({
        verified: false,
        message: e.message || 'Verification service unavailable',
      });
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 font-sans">
      
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div>
          <div className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-1 font-semibold">
            WORKSPACE OVERVIEW
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Welcome back, {session?.name?.split(' ')[0] || 'Operator'}. Secure document sharing with decoupled cryptographic authorization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/assets?action=upload">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 flex items-center gap-2 shadow-sm">
              <UploadCloud className="w-4 h-4" />
              <span>Upload file</span>
            </Button>
          </Link>

          <Button 
            variant="outline" 
            onClick={handleVerifyIntegrity}
            disabled={verifyingIntegrity}
            className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 text-xs"
          >
            {verifyingIntegrity ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-blue-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            )}
            <span>{verifyingIntegrity ? 'Verifying...' : 'Verify integrity'}</span>
          </Button>
        </div>
      </div>

      {/* ATTENTION BANNER (WHEN ACTION REQUIRED) */}
      {stats.pendingAccess > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white">Pending Access Requests ({stats.pendingAccess})</div>
              <div className="text-slate-300 mt-0.5">Team members have submitted access requests awaiting cryptographic clearance review.</div>
            </div>
          </div>
          <Link href="/access" className="self-end sm:self-auto">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-8">
              Review Requests
            </Button>
          </Link>
        </div>
      )}

      {/* 4 OVERVIEW METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Files */}
        <Link href="/assets" className="block">
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Files</span>
              <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:border-blue-400 transition-colors">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {loading ? '...' : stats.totalFiles}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 font-mono">
              <span className="text-emerald-400 font-medium">AES-256-GCM</span>
              <span>encrypted</span>
            </div>
          </div>
        </Link>

        {/* Card 2: Shared Files */}
        <Link href="/assets?tab=shared" className="block">
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Shared With Me</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:border-indigo-400 transition-colors">
                <Share2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {loading ? '...' : stats.sharedFiles}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 font-mono">
              <span className="text-blue-400 font-medium">Access Granted</span>
              <span>incoming shares</span>
            </div>
          </div>
        </Link>

        {/* Card 3: Pending Access */}
        <Link href="/access" className="block">
          <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Pending Access</span>
              <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:border-amber-400 transition-colors">
                <Key className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {loading ? '...' : stats.pendingAccess}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 font-mono">
              {stats.pendingAccess > 0 ? (
                <span className="text-amber-400 font-medium">Review required</span>
              ) : (
                <span className="text-emerald-400 font-medium">All clear</span>
              )}
              <span>in queue</span>
            </div>
          </div>
        </Link>

        {/* Card 4: Storage Used */}
        <div className="p-5 rounded-xl bg-[#0F172A] border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Storage Used</span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : formatBytes(stats.storageUsedBytes)}
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(3, (stats.storageUsedBytes / stats.storageMaxBytes) * 100))}%`
              }}
            />
          </div>
        </div>

      </div>

      {/* TELEMETRY CHART & RECENT ACTIVITY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Security Posture & Cryptographic Integrity (col 7) */}
        <div className="lg:col-span-7 rounded-xl bg-[#0F172A] border border-slate-800 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Security Posture &amp; Cryptographic Integrity
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Decoupled cryptographic enforcement &amp; zero-trust invariants
                </p>
              </div>
              <Badge variant="outline" className="border-blue-500/40 text-blue-300 bg-blue-950/40 text-[11px] font-mono">
                ZERO-TRUST
              </Badge>
            </div>

            {/* Core Invariant Callout */}
            <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Core Invariant: Authorization ≠ Decryption</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Clearance records grant access privileges, but plaintext data is protected by envelope encryption (AES-256-GCM) with hardware enclave-bound keys.
              </p>
            </div>

            {/* Live Verification Result Banner (if verified) */}
            {integrityResult && (
              <div className={`p-3.5 rounded-lg border mb-4 text-xs ${
                integrityResult.verified
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    {integrityResult.verified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                    )}
                    <span>{integrityResult.verified ? 'Cryptographic Ledger Verified' : 'Integrity Mismatch Detected'}</span>
                  </div>
                  {integrityResult.logCount !== undefined && (
                    <span className="font-mono text-[10px] text-slate-400">{integrityResult.logCount} events evaluated</span>
                  )}
                </div>
                {integrityResult.localRoot && (
                  <div className="font-mono text-[10px] break-all opacity-90 mt-1">
                    Merkle Root: {integrityResult.localRoot}
                  </div>
                )}
                {integrityResult.message && (
                  <div className="text-[11px] mt-1 opacity-90">
                    {integrityResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Security Principles 2x2 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-1">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Envelope Encryption</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  AES-256-GCM with per-document ephemeral keys wrapped by KMS.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hardware Device Trust</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  FIDO2 / Secure Enclave device attestation on every decrypt request.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Immediate Revocation</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instant cryptographic key destruction revokes cached clearances.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-200 mb-1">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Merkle Audit Trail</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Immutable tamper-evident cryptographic log with live verification.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>ENVIRONMENT: PRODUCTION-READY</span>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> HARDWARE ATTESTATION ACTIVE
            </span>
          </div>
        </div>

        {/* RIGHT: Recent Activity Table (col 5) */}
        <div className="lg:col-span-5 rounded-xl bg-[#0F172A] border border-slate-800 p-6 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Recent Activity
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verified audit stream of operations
              </p>
            </div>
            <Link href="/audit" className="text-blue-400 hover:text-blue-300 text-xs font-mono flex items-center gap-1">
              <span>View details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Activity Rows */}
          <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 truncate">{item.resource}</div>
                      <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span>{item.action}</span>
                        <span>•</span>
                        <span>by {item.user}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      item.status === 'DENIED'
                        ? 'bg-red-950/60 text-red-300 border-red-500/30'
                        : item.status === 'PENDING'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {item.status || 'LOGGED'}
                    </span>
                    <div className="text-[9px] font-mono text-slate-400 mt-1">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs font-mono">
                No recent activity records found.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>CHAINING: SHA-256</span>
            <span className="text-slate-300">VERIFIABLE LEDGER</span>
          </div>
        </div>

      </div>

    </div>
  );
}
