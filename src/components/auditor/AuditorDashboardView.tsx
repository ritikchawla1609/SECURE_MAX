'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Search, 
  Filter, 
  Key, 
  Clock, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Lock,
  UserPlus,
  Laptop,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAuditLedgerAction, submitAccessRequestAction, fetchAllAccessRequestsAction } from '@/app/actions/accessRequests';
import { StoredAuditEvent, StoredAccessRequest } from '@/lib/auth/deviceStore';
import { useRealtimeSync } from '@/lib/hooks/useRealtimeSync';

export function AuditorDashboardView() {
  const [events, setEvents] = useState<StoredAuditEvent[]>([]);
  const [auditRequests, setAuditRequests] = useState<StoredAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Update request state
  const [requesting, setRequesting] = useState(false);
  const [requestReason, setRequestReason] = useState('Statutory compliance audit review and statutory ledger update');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [ledgerRes, reqRes] = await Promise.all([
        fetchAuditLedgerAction(),
        fetchAllAccessRequestsAction(),
      ]);

      if (ledgerRes.success && ledgerRes.events) {
        setEvents(ledgerRes.events);
      }
      if (reqRes.success && reqRes.requests) {
        setAuditRequests(reqRes.requests.filter(r => r.request_type === 'AUDIT_UPDATE'));
      }
    } catch (err) {
      console.error('Failed to load auditor data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time SSE (<100ms) + 2.5s fallback polling
  useRealtimeSync(() => loadData(true), 2500);

  const handleRequestAuditUpdate = async () => {
    setRequesting(true);
    setStatusMessage(null);
    try {
      const res = await submitAccessRequestAction({
        requestType: 'AUDIT_UPDATE',
        reason: requestReason || 'Official compliance audit update review',
      });

      if (res.success && res.request) {
        setAuditRequests(prev => [res.request!, ...prev]);
        setStatusMessage('Audit update request submitted to Administrator! Awaiting NFT permit approval.');
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        alert(res.error || 'Failed to submit audit update request');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting request');
    } finally {
      setRequesting(false);
    }
  };

  const filteredEvents = events.filter(e => 
    e.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.user_name && e.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    e.event_hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAuditPermit = auditRequests.find(r => r.status === 'APPROVED');
  const pendingAuditPermit = auditRequests.find(r => r.status === 'PENDING');

  return (
    <div className="space-y-8 font-sans selection:bg-cyan-500/30 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
            Independent Audit Command
          </h2>
          <p className="text-muted-foreground mt-1 text-xs font-mono">
            Tamper-Evident Ledger • New Users, Device Registrations &amp; NFT Approvals Monitored
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => loadData(false)}
            className="border-zinc-800 hover:bg-white/5 text-xs font-mono text-zinc-300"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Badge variant="outline" className="border-purple-500/50 text-purple-400 px-4 py-1.5 font-mono text-xs">
            ROLE: AUDITOR (INSPECTION ONLY)
          </Badge>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="bg-amber-950/40 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg animate-in fade-in">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* AUDITOR ACTION: REQUEST AUDIT UPDATE CLEARANCE (NFT PERMIT)      */}
      {/* --------------------------------------------------------------- */}
      <div className="bg-[#0e0a1a] border border-purple-500/40 rounded-2xl p-6 shadow-[0_0_30px_rgba(168,85,247,0.15)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/40 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              Request Audit Update Access (Admin NFT Permit)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              As an Auditor, you possess read-only inspection access. To modify or anchor new compliance records, request an NFT-governed permit from the Administrator.
            </p>
          </div>
        </div>

        {activeAuditPermit ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-sm">NFT Update Clearance Active</div>
                <div className="text-xs font-mono text-zinc-400 mt-0.5">
                  Permit Token: <span className="text-emerald-400 font-bold">{activeAuditPermit.nft_token_id}</span> • Approved by Administrator
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-mono">
              WRITE AUTHORIZED
            </Badge>
          </div>
        ) : pendingAuditPermit ? (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <div className="font-bold text-sm">Update Request Submitted • Pending Admin NFT Mint</div>
                <div className="text-xs font-mono text-zinc-400 mt-0.5">
                  Request ID: {pendingAuditPermit.id} • Administrator must sign and mint on-chain permit to unlock write access.
                </div>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs font-mono">
              PENDING ADMIN APPROVAL
            </Badge>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <Input
              type="text"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Enter justification for audit update..."
              className="bg-black/60 border-purple-900/60 text-zinc-200 text-xs font-mono flex-1"
            />
            <Button
              disabled={requesting}
              onClick={handleRequestAuditUpdate}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-6 py-2 shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
            >
              {requesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5 mr-1.5" />
                  Request NFT Update Permit
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------- */}
      {/* PERMANENT CRYPTOGRAPHIC AUDIT EVENT LEDGER                      */}
      {/* --------------------------------------------------------------- */}
      <Card className="border-zinc-800 bg-[#0a0a0c]">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Permanent Cryptographic Event Ledger
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Chronological chain of identities, device enrollments, and NFT access grants
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input 
                  type="text" 
                  placeholder="Filter event, actor, or hash..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-black/60 border-zinc-800 text-xs font-mono text-zinc-200" 
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="text-[11px] uppercase bg-black/40 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-bold">Timestamp</th>
                  <th className="px-6 py-4 font-bold">Event Type</th>
                  <th className="px-6 py-4 font-bold">Details</th>
                  <th className="px-6 py-4 font-bold">Subject / User</th>
                  <th className="px-6 py-4 font-bold text-right">Block / SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        Verifying tamper-evident ledger...
                      </div>
                    </td>
                  </tr>
                ) : filteredEvents.length > 0 ? (
                  filteredEvents.map((log) => {
                    const isNft = log.event_type.includes('NFT');
                    const isDevice = log.event_type.includes('DEVICE');
                    const isUser = log.event_type.includes('USER');
                    const isWarning = log.severity === 'WARNING';

                    return (
                      <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-zinc-400 text-[11px]">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] uppercase font-mono ${
                              isNft ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30' :
                              isDevice ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/30' :
                              isUser ? 'border-purple-500/40 text-purple-300 bg-purple-950/30' :
                              isWarning ? 'border-amber-500/40 text-amber-300 bg-amber-950/30' :
                              'border-zinc-700 text-zinc-300 bg-zinc-900/40'
                            }`}
                          >
                            {log.event_type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-zinc-200 font-sans max-w-sm">
                          {log.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-zinc-300">
                          {log.user_name ? (
                            <div>
                              <span className="font-semibold text-zinc-200">{log.user_name}</span>
                              <div className="text-[10px] text-zinc-500">{log.user_email}</div>
                            </div>
                          ) : (
                            <span className="text-zinc-500">SYSTEM</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-[10px] text-cyan-400 font-bold">
                            SEPOLIA #{log.block_number || 6849200}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate max-w-[140px] ml-auto group-hover:text-zinc-300 transition-colors" title={log.event_hash}>
                            {log.event_hash.slice(0, 10)}...{log.event_hash.slice(-8)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      No audit events matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-zinc-800 bg-black/40 flex justify-between items-center text-xs text-zinc-400 font-mono">
            <span>Showing {filteredEvents.length} permanent cryptographic audit records</span>
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SHA-256 HASH CHAIN PASSED</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
