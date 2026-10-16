'use client';

import * as React from 'react';
import { ShieldAlert, Fingerprint, Server, Users, FileLock2, ShieldCheck, Clock, ShieldX } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';
import { Badge } from '@/components/ui/badge';

export default function IncidentsPage() {
  const { incidents, resolveIncident } = useDemoStore();
  const [resolving, setResolving] = React.useState<string | null>(null);

  const handleResolve = (id: string) => {
    setResolving(id);
    resolveIncident(id);
    setResolving(null);
  };

  return (
    <div className="space-y-6 font-sans selection:bg-blue-600/30 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div>
          <div className="text-blue-400 font-mono text-xs uppercase tracking-wider mb-1 font-semibold">
            SOC RESPONSE & CONTAINMENT
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-red-400" />
            Incident Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            Real-time attack path investigation, SOC telemetry triggers, and automated threat containment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-xs px-3 py-1 ${incidents.filter(i => i.status !== 'THREAT CONTAINED').length > 0 ? 'border-red-500/40 text-red-400 bg-red-950/40' : 'border-emerald-500/30 text-emerald-400 bg-emerald-950/40'}`}>
            {incidents.filter(i => i.status !== 'THREAT CONTAINED').length > 0 ? `${incidents.filter(i => i.status !== 'THREAT CONTAINED').length} Active Incidents` : 'Zero Active Threats'}
          </Badge>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-16 flex flex-col items-center justify-center text-slate-400">
          <ShieldCheck className="h-12 w-12 mb-3 text-emerald-400 opacity-80" />
          <p className="text-sm font-semibold text-white">No Active Security Incidents</p>
          <p className="text-xs text-slate-400 mt-1">Defense boundaries and KMS zeroization active with zero compromised tokens.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {incidents.map((incident) => {
            const isContained = incident.status === 'THREAT CONTAINED';
            
            return (
              <div key={incident.id} className={`bg-[#0F172A] border ${isContained ? 'border-slate-800' : 'border-red-500/40 shadow-sm'} rounded-xl overflow-hidden transition-all duration-300`}>
                <div className={`p-5 border-b ${isContained ? 'border-slate-800 bg-slate-900/40' : 'border-red-500/30 bg-red-950/20'}`}>
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div>
                       <div className="flex items-center gap-3 mb-1.5">
                         <span className="text-[11px] font-mono text-slate-400">{incident.id}</span>
                         <Badge variant="outline" className={`text-xs font-mono px-2 py-0.5 ${isContained ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30' : 'bg-red-950/40 text-red-400 border-red-500/30 animate-pulse'}`}>
                           {isContained ? 'Threat Contained' : incident.status}
                         </Badge>
                       </div>
                       <h3 className={`text-lg font-bold ${isContained ? 'text-slate-200' : 'text-red-300'}`}>{incident.title}</h3>
                     </div>
                      {!isContained && (
                        <button 
                          type="button"
                          onClick={() => handleResolve(incident.id)}
                          disabled={resolving === incident.id}
                          className="font-mono text-xs font-semibold uppercase px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm active:opacity-90 disabled:opacity-50"
                        >
                          {resolving === incident.id ? 'Containing...' : 'Contain Threat'}
                        </button>
                      )}
                   </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-[#0F172A]">
                  
                  {/* Attack Path */}
                  <div>
                    <h4 className="text-[11px] font-mono tracking-wider text-slate-400 uppercase pb-2 mb-4 border-b border-slate-800 font-semibold">
                      Attack Path Execution
                    </h4>
                    <div className="flex flex-col space-y-3">
                      
                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-400"><Fingerprint className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-slate-300 w-28">Identity Check</span>
                        <span className="text-[11px] font-mono text-emerald-400">✓ Passed</span>
                      </div>
                      <div className="w-px h-3 bg-slate-800 ml-4"></div>
                      
                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-400"><Server className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-slate-300 w-28">Session Bind</span>
                        <span className="text-[11px] font-mono text-emerald-400">✓ Passed</span>
                      </div>
                      <div className="w-px h-3 bg-slate-800 ml-4"></div>

                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-400"><Users className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-slate-300 w-28">RBAC Clearance</span>
                        <span className="text-[11px] font-mono text-emerald-400">✓ Passed</span>
                      </div>
                      <div className="w-px h-3 bg-slate-800 ml-4"></div>

                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-400"><FileLock2 className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-slate-300 w-28">Asset Policy</span>
                        <span className="text-[11px] font-mono text-emerald-400">✓ Passed</span>
                      </div>
                      <div className="w-px h-3 bg-red-500/50 ml-4"></div>

                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-lg border border-red-500/50 bg-red-950/40 flex items-center justify-center text-red-400"><ShieldX className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-red-300 w-28">KMS Release Gate</span>
                        <span className="text-[11px] font-mono text-red-400 font-bold bg-red-950/50 border border-red-500/30 px-2 py-0.5 rounded">Blocked</span>
                      </div>

                    </div>
                  </div>

                  {/* Incident Timeline */}
                  <div>
                    <h4 className="text-[11px] font-mono tracking-wider text-slate-400 uppercase pb-2 mb-4 border-b border-slate-800 font-semibold">
                      Incident Timeline
                    </h4>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="text-[11px] font-mono text-slate-400 pt-0.5">00:00:01</div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200">Unauthorized Decryption Invocation</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">Malicious payload injected against KMS endpoint</div>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-[11px] font-mono text-slate-400 pt-0.5">00:00:02</div>
                        <div>
                          <div className="text-xs font-semibold text-red-400">Detection Triggered</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">Detected by {incident.detectionLayer || 'Chain-2 Policy Monitor'}</div>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-[11px] font-mono text-slate-400 pt-0.5">00:00:03</div>
                        <div>
                          <div className="text-xs font-semibold text-red-400">Fail-Closed Intercept</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">Execution halted at {incident.blockedLayer || 'KMS Decryption Release Gate'}</div>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-[11px] font-mono text-slate-400 pt-0.5">00:00:04</div>
                        <div>
                          <div className="text-xs font-semibold text-emerald-400">Policy Revocation</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">Access token invalidated and session flagged</div>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-[11px] font-mono text-slate-400 pt-0.5">00:00:05</div>
                        <div>
                          <div className="text-xs font-semibold text-emerald-400">Audit Ledger Anchored</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">Forensic evidence hashed and anchored to Chain-1</div>
                        </div>
                      </div>
                      {isContained && (
                        <div className="flex gap-4">
                          <div className="text-[11px] font-mono text-emerald-400 pt-0.5">00:00:06</div>
                          <div>
                            <div className="text-xs font-semibold text-emerald-400">Threat Contained</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">Attacker quarantine enforced by SecOps</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
