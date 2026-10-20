'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Key, CheckCircle2, ShieldCheck, Sparkles, Loader2, Clock, ShieldAlert, FileText, UserCheck, Shield, Ban, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchAllAccessRequestsAction, approveAccessRequestAction, rejectAccessRequestAction } from '@/app/actions/accessRequests';
import { StoredAccessRequest } from '@/lib/auth/deviceStore';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

export function AdminAccessApprovalsCard() {
  const [requests, setRequests] = useState<StoredAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadRequests = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await fetchAllAccessRequestsAction();
      if (res.success && res.requests) {
        setRequests(res.requests);
      }
    } catch (err) {
      console.error('Failed to load access requests:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests(false);
  }, [loadRequests]);

  // Fast real-time sync (<100ms via SSE, 2.5s polling fallback)
  useRealtimeSync(() => loadRequests(true), 2500);

  const handleApprove = async (reqId: string) => {
    setApprovingId(reqId);
    setSuccessBanner(null);
    try {
      const res = await approveAccessRequestAction({ requestId: reqId });
      if (res.success && res.request) {
        setRequests(prev => prev.map(r => r.id === reqId ? res.request! : r));
        setSuccessBanner(`Access Permit approved & minted! NFT Token: ${res.request.nft_token_id}`);
        setTimeout(() => setSuccessBanner(null), 6000);
      } else {
        alert(res.error || 'Failed to approve request');
      }
    } catch (err: any) {
      alert(err.message || 'Approval error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (reqId: string) => {
    const reason = prompt('Please enter rejection justification / reason:') || 'Clearance denied by administrator';
    setRejectingId(reqId);
    setSuccessBanner(null);
    try {
      const res = await rejectAccessRequestAction({ requestId: reqId, reason });
      if (res.success && res.request) {
        setRequests(prev => prev.map(r => r.id === reqId ? res.request! : r));
        setSuccessBanner(`Access request rejected for ${res.request.user_name || res.request.user_email}`);
        setTimeout(() => setSuccessBanner(null), 6000);
      } else {
        alert(res.error || 'Failed to reject clearance');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting request');
    } finally {
      setRejectingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const approvedRequests = requests.filter(r => r.status === 'APPROVED');
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED');

  return (
    <div className="bg-[#0a0f18] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.1)] space-y-5">
      {/* Header with simple language */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-2">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            File Access &amp; Audit Approvals (NFT Permits)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Review team member requests to unlock high-risk files and grant auditor update clearance with on-chain NFT permits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-950/30 font-mono text-xs px-3 py-1">
            {pendingRequests.length} PENDING APPROVALS
          </Badge>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successBanner}</span>
        </div>
      )}

      {/* PENDING APPROVALS SECTION */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          Pending Authorization Queue
        </h3>

        {loading && requests.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-mono flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            Loading pending requests...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-950/40 text-center text-zinc-500 text-xs font-mono">
            No pending access requests. All team requests are fully authorized.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingRequests.map(req => (
              <div 
                key={req.id} 
                className="bg-zinc-950/70 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-amber-500/60 transition-all"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/20">
                      {req.request_type === 'AUDIT_UPDATE' ? 'Auditor Clearance' : 'High-Risk File Access'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="font-bold text-zinc-100 text-sm">{req.asset_name || req.asset_id || 'System Asset Access'}</div>
                  <div className="text-[11px] font-mono text-zinc-400">Target Code: {req.asset_code || req.asset_id || req.id}</div>
                  
                  <div className="bg-zinc-900/60 rounded-lg p-2.5 text-[11px] text-zinc-300 border border-zinc-800/80">
                    <div className="text-[10px] text-zinc-500 uppercase font-semibold">Requester:</div>
                    <div className="font-bold text-zinc-200">{req.user_name || req.user_email || 'Authorized User'}</div>
                    {req.user_email && <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{req.user_email}</div>}
                    <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Role: {req.role || 'USER'}</div>
                    {req.reason && <div className="text-zinc-400 mt-1 italic">&ldquo;{req.reason}&rdquo;</div>}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={approvingId === req.id || rejectingId === req.id}
                    onClick={() => handleApprove(req.id)}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs py-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  >
                    {approvingId === req.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Minting Permit...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        Approve &amp; Mint
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={approvingId === req.id || rejectingId === req.id}
                    onClick={() => handleReject(req.id)}
                    className="border-red-500/40 text-red-400 hover:bg-red-950/40 text-xs py-2"
                  >
                    {rejectingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* APPROVED ON-CHAIN NFT PERMITS (RECENT) */}
      {approvedRequests.length > 0 && (
        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Active NFT Permits (Anchored On-Chain)
          </h3>
          <div className="space-y-2">
            {approvedRequests.slice(0, 4).map(req => (
              <div 
                key={req.id} 
                className="bg-zinc-950/40 border border-emerald-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-zinc-200">{req.asset_name || req.asset_id || 'System Asset Access'}</span>
                    <span className="text-zinc-500 mx-2">•</span>
                    <span className="text-zinc-400">{req.user_name || req.user_email || 'Authorized User'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                    {req.nft_token_id || 'NFT-SEPOLIA-AUTHORIZED'}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {req.approved_at ? new Date(req.approved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ACTIVE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REJECTED REQUESTS (RECENT) */}
      {rejectedRequests.length > 0 && (
        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            Denied Clearances
          </h3>
          <div className="space-y-2">
            {rejectedRequests.slice(0, 3).map(req => (
              <div 
                key={req.id} 
                className="bg-zinc-950/40 border border-red-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <Ban className="w-4 h-4 text-red-400 shrink-0" />
                  <div>
                    <span className="font-bold text-zinc-200">{req.asset_name || req.asset_id || 'System Asset Access'}</span>
                    <span className="text-zinc-500 mx-2">•</span>
                    <span className="text-zinc-400">{req.user_name || req.user_email || 'Authorized User'}</span>
                    {req.rejected_reason && <span className="text-red-400 text-[11px] block mt-0.5">Reason: {req.rejected_reason}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-2.5 py-1 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-[10px] font-bold">
                    CLEARANCE DENIED
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
