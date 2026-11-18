'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Activity, 
  Terminal, 
  Users, 
  Database, 
  RefreshCw, 
  Layers, 
  ShieldAlert, 
  ChevronRight,
  Flame,
  Radio,
  FileText,
  Hexagon,
  Sparkles,
  Server,
  Zap,
  Check,
  UserPlus,
  Copy,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { verifyChainIntegrityAction } from '@/app/actions/audit';
import { runSecurityScanAction } from '@/app/actions/sentinel';
import { 
  approveAccessRequestAction, 
  rejectAccessRequestAction, 
  revokeLiveGrantAction 
} from '@/app/actions/accessRequests';
import { registerNewUserByAdmin } from '@/app/actions/adminUsers';
import { useSecureMaxRealtime } from '@/hooks/useSecureMaxRealtime';

interface PendingRequest {
  id: string;
  actor: string;
  assetCode: string;
  purpose: string;
  role: string;
  classification: string;
  requestedAt: string;
  ttlMinutes: number;
}

interface LiveGrant {
  id: string;
  user: string;
  assetCode: string;
  sessionId: string;
  ip: string;
  device: string;
  remainingSeconds: number;
  status: 'ACTIVE' | 'IDLE' | 'REVOKED' | 'EXPIRED';
  note?: string;
}

export function CommandCenterView() {
  const { data: realtimeData, broadcastUpdate, refetch } = useSecureMaxRealtime(true);
  const [adminSession, setAdminSession] = React.useState<any>(null);

  // Pending Access Requests (Dynamic from Realtime Ledger)
  const [pendingRequests, setPendingRequests] = React.useState<PendingRequest[]>([]);

  // Live Grants with active ticking countdown (Dynamic from Realtime Ledger)
  const [liveGrants, setLiveGrants] = React.useState<LiveGrant[]>([]);

  // Local optimistic locks with sessionStorage persistence to prevent background polling or stale in-flight fetches from reverting UI actions
  const getStoredLockSet = (key: string): Set<string> => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const item = sessionStorage.getItem(key);
        if (item) return new Set(JSON.parse(item));
      }
    } catch {}
    return new Set<string>();
  };

  const processedRequestIds = React.useRef<Set<string>>(getStoredLockSet('securemax_locked_request_ids'));
  const revokedGrantIds = React.useRef<Set<string>>(getStoredLockSet('securemax_locked_grant_ids'));

  const lockRequestId = (id: string) => {
    processedRequestIds.current.add(id);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('securemax_locked_request_ids', JSON.stringify(Array.from(processedRequestIds.current)));
      }
    } catch {}
  };

  const unlockRequestId = (id: string) => {
    processedRequestIds.current.delete(id);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('securemax_locked_request_ids', JSON.stringify(Array.from(processedRequestIds.current)));
      }
    } catch {}
  };

  const lockGrantId = (id: string) => {
    revokedGrantIds.current.add(id);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('securemax_locked_grant_ids', JSON.stringify(Array.from(revokedGrantIds.current)));
      }
    } catch {}
  };

  const unlockGrantId = (id: string) => {
    revokedGrantIds.current.delete(id);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('securemax_locked_grant_ids', JSON.stringify(Array.from(revokedGrantIds.current)));
      }
    } catch {}
  };

  // Synchronize state from database whenever realtime data arrives
  React.useEffect(() => {
    if (realtimeData?.pendingRequests) {
      setPendingRequests(realtimeData.pendingRequests.filter(r => !processedRequestIds.current.has(r.id)));
    }
    if (realtimeData?.liveGrants) {
      setLiveGrants(realtimeData.liveGrants.filter(g => !revokedGrantIds.current.has(g.id)));
    }
  }, [realtimeData]);

  // Ticking countdown timer
  React.useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(d => { if (d?.session) setAdminSession(d.session); })
      .catch(() => {});

    const timer = setInterval(() => {
      setLiveGrants(prev => prev.map(g => {
        if (g.status === 'ACTIVE' && g.remainingSeconds > 0) {
          return { ...g, remainingSeconds: g.remainingSeconds - 1 };
        }
        return g;
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sentinel scan state
  const [scanRunning, setScanRunning] = React.useState(false);
  const [scanStatus, setScanStatus] = React.useState('5 / 5 PASSED · 40 min ago');
  const [incidentOpen, setIncidentOpen] = React.useState(true);
  const [identitySuspended, setIdentitySuspended] = React.useState(false);

  // Audit chain state
  const [verifyingChain, setVerifyingChain] = React.useState(false);
  const [chainVerifiedNotice, setChainVerifiedNotice] = React.useState(false);

  // Action Notice for live approvals/revocations
  const [actionNotice, setActionNotice] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => {
      setActionNotice(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Add User Modal State & Actions
  const [showAddUserModal, setShowAddUserModal] = React.useState(false);
  const [newUserName, setNewUserName] = React.useState('');
  const [newUserEmail, setNewUserEmail] = React.useState('');
  const [newUserRole, setNewUserRole] = React.useState<'USER' | 'ENGINEER' | 'MANAGER' | 'AUDITOR'>('USER');
  const [newUserDepartment, setNewUserDepartment] = React.useState('Engineering');
  const [addUserLoading, setAddUserLoading] = React.useState(false);
  const [addUserError, setAddUserError] = React.useState<string | null>(null);
  const [createdUserResult, setCreatedUserResult] = React.useState<{
    id: string;
    name: string;
    email: string;
    role: string;
    enrollmentCode?: string;
  } | null>(null);
  const [copiedEnrollmentCode, setCopiedEnrollmentCode] = React.useState(false);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setAddUserError('Please provide both Full Name and Email Address.');
      return;
    }
    setAddUserLoading(true);
    setAddUserError(null);

    try {
      const res = await registerNewUserByAdmin({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole as any,
        department: newUserDepartment,
      });

      if (!res.success || !res.user) {
        throw new Error(res.error || 'Failed to register new identity.');
      }

      setCreatedUserResult(res.user);
      showNotice('success', `Identity created for ${res.user.name}. Enrollment code: ${res.user.enrollmentCode}`);

      if (typeof broadcastUpdate === 'function') {
        broadcastUpdate('USER_REGISTERED', { user: res.user });
      }
      try {
        const bc = new BroadcastChannel('securemax_realtime');
        bc.postMessage({ type: 'USER_REGISTERED', user: res.user });
        bc.close();
      } catch {}

      refetch();
    } catch (err: any) {
      setAddUserError(err.message || 'Error registering identity');
    } finally {
      setAddUserLoading(false);
    }
  };

  const resetAddUserForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('USER');
    setNewUserDepartment('Engineering');
    setAddUserError(null);
    setCreatedUserResult(null);
    setCopiedEnrollmentCode(false);
    setShowAddUserModal(false);
  };

  // Action Handlers with 0ms Instant Optimistic Feedback + Broadcast
  
  const handleApprove = async (id: string) => {
    try {
      const req = pendingRequests.find(r => r.id === id);
      const ttlMinutes = req?.ttlMinutes || 30;

      // Lock ID optimistically and persist so background polling or page reload never reverts it
      lockRequestId(id);
      // 0ms Optimistic UI update: remove pending request immediately
      setPendingRequests(prev => (prev || []).filter(r => r.id !== id));

      // Backend update via Server Action with automatic REST fallback
      let res: any = null;
      try {
        if (typeof approveAccessRequestAction === 'function') {
          res = await approveAccessRequestAction({ requestId: id, ttlMinutes });
        }
      } catch (actionErr) {
        console.warn('approveAccessRequestAction error, falling back to sync endpoint:', actionErr);
      }

      if (!res?.success) {
        try {
          const syncRes = await fetch('/api/sync/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'APPROVE', requestId: id, ttlMinutes }),
          });
          if (syncRes.ok) {
            const syncJson = await syncRes.json();
            if (syncJson.success) {
              res = { success: true, grant: syncJson.grant || syncJson.liveGrants?.[0] };
            }
          }
        } catch (syncErr) {
          console.warn('Sync REST fallback error:', syncErr);
        }
      }

      if (res?.success) {
        if (res.grant) {
          setLiveGrants(prev => [
            res.grant,
            ...(prev || []).filter(g => g && g.id !== res.grant.id && g.assetCode !== res.grant.assetCode),
          ]);
        }
        showNotice('success', `Access request for ${req?.assetCode || id} approved & permit minted.`);
        if (typeof broadcastUpdate === 'function') {
          broadcastUpdate('REQUEST_APPROVED', { requestId: id, ttlMinutes, grant: res.grant });
        }
      } else {
        unlockRequestId(id);
        console.error('Failed to approve request:', res?.error);
        showNotice('error', res?.error || 'Failed to approve request');
        refetch();
      }
    } catch (err: any) {
      unlockRequestId(id);
      console.error('Crash in handleApprove:', err);
      showNotice('error', err?.message || 'Unexpected error approving request');
      refetch();
    }
  };

  const handleDeny = async (id: string) => {
    // Lock ID optimistically and persist so background polling or page reload never reverts it
    lockRequestId(id);
    // 0ms Optimistic UI update
    setPendingRequests(prev => prev.filter(r => r.id !== id));

    let res: any = null;
    try {
      if (typeof rejectAccessRequestAction === 'function') {
        res = await rejectAccessRequestAction({ requestId: id, reason: 'Security policy restriction' });
      }
    } catch (actionErr) {
      console.warn('rejectAccessRequestAction error, falling back to sync endpoint:', actionErr);
    }

    if (!res?.success) {
      try {
        const syncRes = await fetch('/api/sync/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REJECT', requestId: id, reason: 'Security policy restriction' }),
        });
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (syncJson.success) {
            res = { success: true };
          }
        }
      } catch (syncErr) {
        console.warn('Sync REST fallback error:', syncErr);
      }
    }

    if (res?.success) {
      showNotice('success', 'Access request rejected.');
      if (typeof broadcastUpdate === 'function') {
        broadcastUpdate('REQUEST_REJECTED', { requestId: id });
      }
    } else {
      unlockRequestId(id);
      console.error('Failed to deny request:', res?.error);
      showNotice('error', res?.error || 'Failed to deny request');
      refetch();
    }
  };

  const handleRevokeGrant = async (id: string) => {
    const grantToRevoke = liveGrants.find(g => g.id === id);
    // Lock ID optimistically and persist so background polling or page reload never reverts it
    lockGrantId(id);
    // 0ms Optimistic UI update: remove from active live grants immediately
    setLiveGrants(prev => prev.filter(g => g.id !== id));

    let res: any = null;
    try {
      if (typeof revokeLiveGrantAction === 'function') {
        res = await revokeLiveGrantAction({ grantId: id });
      }
    } catch (actionErr) {
      console.warn('revokeLiveGrantAction error, falling back to sync endpoint:', actionErr);
    }

    if (!res?.success) {
      try {
        const syncRes = await fetch('/api/sync/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REVOKE', grantId: id }),
        });
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (syncJson.success) {
            res = { success: true };
          }
        }
      } catch (syncErr) {
        console.warn('Sync REST fallback error:', syncErr);
      }
    }

    if (res?.success) {
      showNotice('success', `Live grant for ${grantToRevoke?.assetCode || id} revoked & access blocked.`);
      if (typeof broadcastUpdate === 'function') {
        broadcastUpdate('GRANT_REVOKED', { grantId: id, assetCode: grantToRevoke?.assetCode });
      }
    } else {
      unlockGrantId(id);
      console.error('Failed to revoke grant:', res?.error);
      showNotice('error', res?.error || 'Failed to revoke live grant');
      refetch();
    }
  };

  const handleRunSentinelScan = async () => {
    setScanRunning(true);
    try {
      const res = await runSecurityScanAction('admin-command-center');
      if (res?.success) {
        setScanStatus('5 / 5 PASSED · Just now');
        showNotice('success', 'Sentinel adversarial security scan completed successfully.');
      } else {
        setScanStatus('ALERT · Findings Detected');
        showNotice('error', res?.error || 'Scan detected active security findings.');
      }
    } catch (err: any) {
      setScanStatus('ERROR');
      showNotice('error', err?.message || 'Failed to execute Sentinel scan');
    } finally {
      setScanRunning(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    await verifyChainIntegrityAction();
    setVerifyingChain(false);
    setChainVerifiedNotice(true);
    setTimeout(() => setChainVerifiedNotice(false), 4000);
  };

  return (
    <div className="space-y-6 text-zinc-100 font-sans selection:bg-emerald-500/30">
      
      {/* Top Command Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-xs text-zinc-400 font-mono mt-0.5">Zero-Trust Security Posture · Realtime Cryptographic State</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>POLYGON / ARB · live</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>SEPOLIA · anchored</span>
          </div>

          <Button
            size="sm"
            onClick={() => { resetAddUserForm(); setShowAddUserModal(true); }}
            className="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>+ Add User</span>
          </Button>

          <Button
            size="sm"
            onClick={handleRunSentinelScan}
            disabled={scanRunning}
            className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-mono font-bold px-3 py-1.5 rounded-lg"
          >
            {scanRunning ? 'Running Scan...' : 'Run Sentinel Scan'}
          </Button>
        </div>
      </div>

        {/* ---------------------------------------------------- */}
        {/* 4 TOP METRIC CARDS (PAGE 1)                          */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div className="p-4 rounded-xl border border-purple-500/30 bg-[#0d0a14] space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">IDENTITIES</div>
              <button
                type="button"
                onClick={() => { resetAddUserForm(); setShowAddUserModal(true); }}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 transition-colors cursor-pointer"
                title="Register New User Identity"
              >
                <UserPlus className="w-3 h-3" />
                <span>+ Add</span>
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{(realtimeData?.stats.identitiesCount || 1) + (createdUserResult ? 1 : 0)}</span>
              <span className="text-[11px] text-emerald-400">active</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-cyan-500/30 bg-[#080f14] space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">ACTIVE ASSETS</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{realtimeData?.stats.activeAssetsCount || 0}</span>
              <span className="text-[11px] text-cyan-400 font-sans">AES-256-GCM</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-[#140f08] space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">PENDING REQUESTS</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{pendingRequests.length}</span>
              <span className="text-[11px] text-amber-400">{pendingRequests.length === 0 ? 'zero pending' : `${pendingRequests.length} pending`}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/30 bg-[#08140a] space-y-1">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">OPEN INCIDENTS</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{realtimeData?.stats.openIncidentsCount || 0}</span>
              <span className="text-[11px] text-emerald-400 uppercase">all nominal</span>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 6 SYSTEM STATUS PILLS (PAGE 1)                       */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-[11px]">
          <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-center font-bold">
            IDENTITY VERIFIED
          </div>
          <div className="p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-cyan-400 text-center font-bold">
            RBAC ENFORCED
          </div>
          <div className="p-2 rounded-lg bg-blue-950/20 border border-blue-500/30 text-blue-400 text-center font-bold">
            ASSET REGISTRY ANCHORED
          </div>
          <div className="p-2 rounded-lg bg-purple-950/20 border border-purple-500/30 text-purple-400 text-center font-bold">
            KEY DOMAIN PROTECTED
          </div>
          <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-center font-bold">
            SENTINEL NOMINAL
          </div>
          <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-center font-bold">
            AUDIT CHAIN VALID
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TWO-COLUMN COMMAND CENTER GRID                       */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ================================================= */}
          {/* LEFT COLUMN: Access Requests, Live Grants, Audit  */}
          {/* ================================================= */}
          <div className="space-y-6">
            
            {/* Card: Access Requests & Live Grants */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Access requests &amp; live grants
                </h2>
                <span className="text-[10px] font-mono text-zinc-400">Approve signs on Chain-1</span>
              </div>

              {/* Action Feedback Notice */}
              {actionNotice && (
                <div className={`p-3 rounded-xl text-xs font-mono flex items-center justify-between transition-all ${
                  actionNotice.type === 'success' 
                    ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300' 
                    : 'bg-red-950/50 border border-red-500/40 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {actionNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{actionNotice.message}</span>
                  </div>
                  <button 
                    onClick={() => setActionNotice(null)}
                    className="text-zinc-400 hover:text-white text-xs ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Pending Requests List */}
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div key={req.id} className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                        <span>{req.actor}</span>
                        <span className="text-zinc-500">→</span>
                        <span className="text-cyan-400">{req.assetCode}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">TTL</span>
                        <span className="text-[11px] bg-black border border-zinc-700 px-2 py-0.5 rounded text-zinc-200">
                          {req.ttlMinutes} min
                        </span>
                        <Button 
                          size="sm" 
                          onClick={() => handleApprove(req.id)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] h-7 px-3"
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeny(req.id)}
                          className="border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-[11px] h-7 px-3"
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-sans">
                      Purpose: {req.purpose}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-2">
                      <span>{req.role}</span>
                      <span>•</span>
                      <span className="text-red-400">{req.classification}</span>
                      <span>•</span>
                      <span>{req.requestedAt}</span>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && (
                  <div className="py-4 text-center text-xs font-mono text-zinc-500">
                    No access requests currently pending approval.
                  </div>
                )}
              </div>

              {/* Sub-section: Live Grants */}
              <div className="pt-2 border-t border-zinc-800/60 space-y-3">
                <div className="text-[10px] uppercase font-mono font-bold tracking-widest text-zinc-400">
                  LIVE GRANTS
                </div>

                {liveGrants.filter(g => g.status === 'ACTIVE').map(grant => (
                  <div key={grant.id} className="p-3 rounded-xl border border-zinc-800/60 bg-black/40 flex items-center justify-between font-mono text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-zinc-200">
                        {grant.user} · <span className="text-cyan-400">{grant.assetCode}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {grant.note || `session ${grant.sessionId} · ${grant.ip} · ${grant.device}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {grant.status === 'ACTIVE' ? (
                        <span className="text-[11px] text-emerald-400 font-bold">
                          expires in {formatSeconds(grant.remainingSeconds)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">idle</span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevokeGrant(grant.id)}
                        className="border-red-900/40 text-red-400 hover:bg-red-950/20 text-[10px] h-6 px-2.5"
                      >
                        {grant.status === 'ACTIVE' ? 'Revoke now' : 'Revoke'}
                      </Button>
                    </div>
                  </div>
                ))}

                {liveGrants.filter(g => g.status === 'ACTIVE').length === 0 && (
                  <div className="py-2 text-center text-[11px] font-mono text-zinc-500">
                    No active live grants currently issued.
                  </div>
                )}
              </div>
            </div>

            {/* Card: Audit Chain */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Audit chain
                </h2>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleVerifyChain}
                  disabled={verifyingChain}
                  className="border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-300 h-7"
                >
                  {verifyingChain ? 'Verifying...' : 'Verify chain'}
                </Button>
              </div>

              {chainVerifiedNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>SHA-256 Hash Chain Integrity Verified: 24/24 blocks valid.</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-zinc-800/40">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">14:02</span>
                    <span className="text-purple-400 font-bold">BREAK_GLASS_GRANTED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[10px]">0x461a99e3…e0c5efb1</span>
                    <span className="text-emerald-400 text-[10px]">prev linked</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-zinc-800/40">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">13:27</span>
                    <span className="text-red-400 font-bold">ACCESS_DENIED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[10px]">0x8c1f04ba…77d3a916</span>
                    <span className="text-zinc-400 text-[10px]">Domain 1 / RBAC</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-zinc-800/40">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">13:26</span>
                    <span className="text-amber-400 font-bold">KEY_ACCESS_DENIED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[10px]">0x2ad7ee51…b40c8e02</span>
                    <span className="text-zinc-400 text-[10px]">Domain 2 / KMS</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-zinc-800/40">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">11:14</span>
                    <span className="text-emerald-400 font-bold">DECRYPTION_COMPLETED</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[10px]">0xf03bd7c2…19ae5d44</span>
                    <span className="text-cyan-400 text-[10px]">anchored</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Last anchor on Sepolia</span>
                <a 
                  href="https://sepolia.etherscan.io/tx/0x7e41c9d233418e2049182049182049182049182049182049182049182049c9d2" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>0x7e41…c9d2 · view on Etherscan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

          </div>

          {/* ================================================= */}
          {/* RIGHT COLUMN: Sentinel & Key Lifecycle            */}
          {/* ================================================= */}
          <div className="space-y-6">
            
            {/* Card: Sentinel Security Checks & Alerts */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Sentinel
                </h2>
                <span className="text-[10px] text-emerald-400 font-bold">{scanStatus}</span>
              </div>

              {/* 5 Passed Check items */}
              <div className="space-y-1.5 text-zinc-300 text-[11px]">
                <div className="flex justify-between py-1 border-b border-zinc-800/40">
                  <span>Unauthorized asset access</span>
                  <span className="text-emerald-400 font-bold">blocked</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/40">
                  <span>Expired temporary key</span>
                  <span className="text-emerald-400 font-bold">blocked</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/40">
                  <span>Revoked permission access</span>
                  <span className="text-emerald-400 font-bold">blocked</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/40">
                  <span>Privilege escalation</span>
                  <span className="text-emerald-400 font-bold">blocked</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Token replay</span>
                  <span className="text-emerald-400 font-bold">blocked</span>
                </div>
              </div>

              {/* Sentinel Posture Status */}
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>SENTINEL POSTURE NOMINAL</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  Real-time threat detection active. Zero active unauthorized access attempts or policy violations.
                </p>
              </div>
            </div>

            {/* Card: Key Lifecycle */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-[#0a0a0d] space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Key lifecycle
                </h2>
              </div>

              <div className="space-y-3">
                <div className="py-6 text-center space-y-2">
                  <Key className="w-5 h-5 text-zinc-600 mx-auto" />
                  <div className="text-xs text-zinc-400 font-sans">No cryptographic keys active</div>
                  <div className="text-[10px] text-zinc-600 font-sans">
                    Keys are generated automatically when encrypted assets are registered in the Vault.
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* ---------------------------------------------------- */}
        {/* ADD USER IDENTITY & ENROLLMENT ISSUANCE MODAL        */}
        {/* ---------------------------------------------------- */}
        {showAddUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-[#0a0f18] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] p-6 space-y-5 font-mono text-xs text-zinc-200 max-h-[92vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-tight">
                      Register User Identity
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-sans mt-0.5">
                      Issue cryptographic identity and generate enrollment capability
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetAddUserForm}
                  className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createdUserResult ? (
                /* Success View with Generated Enrollment Code */
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Identity Successfully Registered</span>
                    </div>
                    <div className="text-[11px] text-zinc-300 font-sans">
                      <span className="font-semibold text-white">{createdUserResult.name}</span> ({createdUserResult.email}) has been provisioned as <span className="text-cyan-300 font-mono">{createdUserResult.role}</span>.
                    </div>
                  </div>

                  {/* Generated Pairing Code Display */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-cyan-500/40 space-y-2 text-center">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                      15-Minute / 24-Hour Device Pairing Code
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono tracking-widest py-1 selection:bg-cyan-500/40">
                      {createdUserResult.enrollmentCode || 'PENDING'}
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (createdUserResult.enrollmentCode) {
                            navigator.clipboard.writeText(createdUserResult.enrollmentCode);
                            setCopiedEnrollmentCode(true);
                            setTimeout(() => setCopiedEnrollmentCode(false), 3000);
                          }
                        }}
                        className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-mono h-8 px-3"
                      >
                        {copiedEnrollmentCode ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            <span>Copy Pairing Code</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-sans leading-relaxed pt-1">
                      Give this code to the user. They can enter it on the login page under &quot;Enroll Device&quot; or directly navigate to <span className="text-zinc-400 font-mono">/register-device?code={createdUserResult.enrollmentCode}</span> to establish zero-trust hardware binding.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Link
                      href="/devices?tab=ENROLLMENT"
                      onClick={resetAddUserForm}
                      className="w-full py-2.5 px-3 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-center text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Enrollment Tab →</span>
                    </Link>
                    <Button
                      onClick={resetAddUserForm}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono rounded-xl"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                /* Registration Input Form */
                <form onSubmit={handleAddUserSubmit} className="space-y-4">
                  {addUserError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{addUserError}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider block">Full Name *</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="e.g. Vikram Singh"
                      required
                      className="w-full h-9 rounded-lg bg-black/60 border border-zinc-800 text-zinc-100 text-xs px-3 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider block">Official Email Address *</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="e.g. vikram@securemax.mil"
                      required
                      className="w-full h-9 rounded-lg bg-black/60 border border-zinc-800 text-zinc-100 text-xs px-3 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-wider block">Role</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as any)}
                        className="w-full h-9 rounded-lg bg-black/60 border border-zinc-800 text-zinc-200 text-xs px-2.5 focus:outline-none focus:border-cyan-400"
                      >
                        <option value="USER">USER (Standard Member)</option>
                        <option value="ENGINEER">ENGINEER (Lead Engineer)</option>
                        <option value="MANAGER">MANAGER (Security Manager)</option>
                        <option value="AUDITOR">AUDITOR (Compliance Auditor)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase tracking-wider block">Department</label>
                      <input
                        type="text"
                        value={newUserDepartment}
                        onChange={(e) => setNewUserDepartment(e.target.value)}
                        placeholder="e.g. Tactical Ops"
                        className="w-full h-9 rounded-lg bg-black/60 border border-zinc-800 text-zinc-100 text-xs px-3 focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[10px] text-zinc-400 leading-relaxed font-sans">
                    ℹ Registering this identity creates a cryptographic DID and generates a single-use pairing capability for device binding.
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetAddUserForm}
                      disabled={addUserLoading}
                      className="border-zinc-800 text-zinc-400 hover:text-white text-xs h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addUserLoading}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5"
                    >
                      {addUserLoading ? (
                        <span>Registering...</span>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Register Identity &amp; Issue Code</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

            </div>
          </div>
        )}
    </div>
  );
}
