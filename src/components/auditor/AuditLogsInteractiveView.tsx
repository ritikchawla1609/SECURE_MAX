'use client';

import * as React from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Sparkles, 
  Clock, 
  FileText, 
  ExternalLink,
  Shield,
  Layers,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export interface AuditRecord {
  id: string;
  created_at: string;
  event_type: string;
  status: string;
  actor_did: string;
  target_type: string;
  source: string;
  event_hash: string;
  prev_hash: string;
  details?: any;
}

export function AuditLogsInteractiveView({ initialEvents }: { initialEvents: AuditRecord[] }) {
  const { toast } = useToast();
  const [events, setEvents] = React.useState<AuditRecord[]>(initialEvents);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'SUCCESS' | 'DENIED'>('ALL');
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);

  // Verification State
  const [verifying, setVerifying] = React.useState(false);
  const [verificationResult, setVerificationResult] = React.useState<{
    verified: boolean;
    localRoot?: string;
    onChainRoot?: string | null;
    logCount?: number;
    message?: string;
  } | null>(null);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await fetch('/api/audit/verify');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Audit verification request rejected');
      }

      setVerificationResult(data);
      if (data.verified) {
        toast({
          type: 'success',
          title: 'Integrity Verified',
          message: `All ${data.logCount || events.length} audit records cryptographically verified against Sepolia anchor.`,
        });
      } else {
        toast({
          type: 'info',
          title: 'Ledger Evaluated',
          message: data.message || `Local Merkle root computed across ${data.logCount || events.length} events.`,
        });
      }
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Could not verify blockchain anchor',
      });
    } finally {
      setVerifying(false);
    }
  };

  const filteredEvents = React.useMemo(() => {
    return events.filter((e) => {
      if (statusFilter === 'SUCCESS' && e.status !== 'SUCCESS') return false;
      if (statusFilter === 'DENIED' && e.status !== 'DENIED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAction = e.event_type.toLowerCase().includes(q);
        const matchActor = e.actor_did.toLowerCase().includes(q);
        const matchTarget = e.target_type.toLowerCase().includes(q);
        const matchHash = e.event_hash?.toLowerCase().includes(q);
        if (!matchAction && !matchActor && !matchTarget && !matchHash) return false;
      }
      return true;
    });
  }, [events, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 font-sans pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-mono text-xs uppercase tracking-widest mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            IMMUTABLE LEDGER
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Audit Logs
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-light">
            Tamper-evident, cryptographically chained SHA-256 event records anchored to Chain-1 AuditAnchor.sol.
          </p>
        </div>

        {/* Primary Action Button */}
        <Button
          onClick={handleVerifyIntegrity}
          disabled={verifying}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs tracking-wider shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
        >
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Merkle Tree...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Verify Integrity</span>
            </>
          )}
        </Button>
      </div>

      {/* Verification Results Banner */}
      {verificationResult && (
        <div className="p-4 rounded-xl bg-[#0F172A] border border-emerald-500/30 shadow-md animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">
                  {verificationResult.verified ? 'Cryptographic Verification Passed' : 'Merkle Root Evaluated'}
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {verificationResult.message}
                </p>
              </div>
            </div>

            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/30 text-[10px] font-mono shrink-0">
              TAMPER-EVIDENT
            </Badge>
          </div>

          {verificationResult.localRoot && (
            <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="text-slate-400 truncate">
                <span className="text-slate-500">LOCAL ROOT: </span>
                <span className="text-blue-400">{verificationResult.localRoot}</span>
              </div>
              <div className="text-slate-400 truncate">
                <span className="text-slate-500">CHAIN-1 ANCHOR: </span>
                <span className="text-emerald-400">SEPOLIA TESTNET</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            type="search"
            placeholder="Search by action, user, resource, or hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-slate-200 text-xs rounded-lg font-sans placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              statusFilter === 'ALL'
                ? 'border-blue-500 bg-blue-950/40 text-blue-300 font-semibold'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Logs ({events.length})
          </button>
          <button
            onClick={() => setStatusFilter('SUCCESS')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              statusFilter === 'SUCCESS'
                ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Allowed Only
          </button>
          <button
            onClick={() => setStatusFilter('DENIED')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              statusFilter === 'DENIED'
                ? 'border-red-500 bg-red-950/40 text-red-300 font-semibold'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Denied Only
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-slate-800 bg-[#0F172A] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-mono tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Time</th>
                <th className="px-5 py-3.5 font-semibold">Action</th>
                <th className="px-5 py-3.5 font-semibold">Resource</th>
                <th className="px-5 py-3.5 font-semibold">User / Actor</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((log) => {
                  const isDenied = log.status === 'DENIED';
                  const isExpanded = expandedRow === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedRow(isExpanded ? null : log.id);
                          }
                        }}
                        className="hover:bg-slate-900/50 focus:bg-slate-900/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors cursor-pointer"
                      >
                        {/* Time */}
                        <td className="px-5 py-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                          <span className="text-slate-500">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-3.5 font-medium text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>{log.event_type}</span>
                          </div>
                        </td>

                        {/* Resource */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono">
                            {log.target_type || 'SYSTEM'}
                          </span>
                        </td>

                        {/* User / Actor */}
                        <td className="px-5 py-3.5 text-slate-300 font-mono whitespace-nowrap truncate max-w-[200px]">
                          {log.actor_did}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                            isDenied 
                              ? 'bg-red-950/40 text-red-400 border-red-500/30' 
                              : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {isDenied ? (
                              <>
                                <AlertTriangle className="w-3 h-3 text-red-400" />
                                <span>Denied</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Allowed</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* Integrity / Expand Chevron */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors">
                            {verificationResult?.verified ? (
                              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Verified
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500">
                                Verification available
                              </span>
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Cryptographic Proof Details */}
                      {isExpanded && (
                        <tr className="bg-slate-950/60 border-t border-slate-800/80">
                          <td colSpan={6} className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                              {/* Left */}
                              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Event Details</div>
                                <div className="text-slate-300">Target: <span className="text-blue-400">{log.target_type}</span></div>
                                <div className="text-slate-400 text-[11px]">Source: {log.source}</div>
                              </div>

                              {/* Center */}
                              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cryptographic Hash</div>
                                <div className="text-slate-400 text-[10px] break-all leading-relaxed">
                                  <span className="text-slate-500">EVENT: </span>{log.event_hash}
                                </div>
                                <div className="text-slate-500 text-[10px] break-all leading-relaxed">
                                  <span>PREV: </span>{log.prev_hash}
                                </div>
                              </div>

                              {/* Right */}
                              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Blockchain Anchor</div>
                                {verificationResult?.verified ? (
                                  <div className="text-emerald-400 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Sepolia Anchor Verified</span>
                                  </div>
                                ) : (
                                  <div className="text-slate-400 flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-blue-400" />
                                    <span>Sepolia Anchor Registered</span>
                                  </div>
                                )}
                                <div className="text-slate-500 text-[10px]">Contract: AuditAnchor.sol</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500 font-mono text-xs">
                    No audit records match your search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
