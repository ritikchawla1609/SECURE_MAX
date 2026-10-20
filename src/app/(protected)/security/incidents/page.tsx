'use client';

import * as React from 'react';
import { ShieldAlert, Fingerprint, Server, Users, FileLock2, ShieldCheck, Clock, ShieldX } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';

export default function IncidentsPage() {
  const { incidents, resolveIncident } = useDemoStore();
  const [resolving, setResolving] = React.useState<string | null>(null);

  const handleResolve = (id: string) => {
    setResolving(id);
    resolveIncident(id);
    setResolving(null);
  };

  return (
    <div className="space-y-8 font-sans selection:bg-cyan-500/30 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100 uppercase flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Incident Investigation
        </h2>
        <p className="text-sm text-zinc-500 font-mono tracking-widest mt-1 uppercase">SOC Analysis & Containment</p>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-16 flex flex-col items-center justify-center text-zinc-600">
          <ShieldCheck className="h-12 w-12 mb-4 opacity-50 text-emerald-500" />
          <p className="text-xs font-mono tracking-widest uppercase">No Active Security Incidents</p>
        </div>
      ) : (
        <div className="space-y-8">
          {incidents.map((incident) => {
            const isContained = incident.status === 'THREAT CONTAINED';
            
            return (
              <div key={incident.id} className={`bg-[#0a0a0c] border ${isContained ? 'border-emerald-500/30' : 'border-red-500/30'} rounded-lg overflow-hidden transition-colors duration-500`}>
                <div className={`p-6 border-b ${isContained ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div>
                       <div className="flex items-center gap-3 mb-2">
                         <div className="text-[10px] font-mono tracking-widest text-zinc-500">{incident.id}</div>
                         <div className={`text-[10px] font-mono tracking-widest px-2 py-0.5 rounded ${isContained ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500 animate-pulse'}`}>
                           {isContained ? 'CONTAINED' : incident.status}
                         </div>
                       </div>
                       <h3 className={`text-xl font-bold tracking-widest uppercase ${isContained ? 'text-zinc-300' : 'text-red-400'}`}>{incident.title}</h3>
                     </div>
                      {!isContained && (
                        <button 
                          type="button"
                          onClick={() => handleResolve(incident.id)}
                          disabled={resolving === incident.id}
                          className="font-mono text-[10px] tracking-widest uppercase px-6 py-3 rounded bg-zinc-100 text-zinc-950 hover:bg-white transition-colors flex items-center gap-2 cursor-pointer select-none touch-manipulation active:opacity-90 disabled:opacity-50"
                        >
                          {resolving === incident.id ? 'CONTAINING...' : 'CONTAIN THREAT'}
                        </button>
                      )}
                   </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                  
                  {/* Attack Path */}
                  <div>
                    <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase pb-4 mb-6 border-b border-zinc-800">Attack Path Execution</h4>
                    <div className="flex flex-col space-y-4">
                      
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400"><Fingerprint className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-zinc-300 w-24">IDENTITY</span>
                        <span className="text-[10px] font-mono text-emerald-500">✓ PASSED</span>
                      </div>
                      <div className="w-px h-4 bg-zinc-800 ml-4"></div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400"><Server className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-zinc-300 w-24">SESSION</span>
                        <span className="text-[10px] font-mono text-emerald-500">✓ PASSED</span>
                      </div>
                      <div className="w-px h-4 bg-zinc-800 ml-4"></div>

                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400"><Users className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-zinc-300 w-24">RBAC</span>
                        <span className="text-[10px] font-mono text-emerald-500">✓ PASSED</span>
                      </div>
                      <div className="w-px h-4 bg-zinc-800 ml-4"></div>

                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400"><FileLock2 className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-zinc-300 w-24">ASSET POLICY</span>
                        <span className="text-[10px] font-mono text-emerald-500">✓ PASSED</span>
                      </div>
                      <div className="w-px h-4 bg-red-500/50 ml-4"></div>

                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded border border-red-500 bg-red-500/10 flex items-center justify-center text-red-500"><ShieldX className="w-4 h-4"/></div>
                        <span className="font-mono text-xs text-red-400 w-24">DEFENSE GATE</span>
                        <span className="text-[10px] font-mono text-red-500 font-bold bg-red-500/20 px-2 py-0.5 rounded">BLOCKED</span>
                      </div>

                    </div>
                  </div>

                  {/* Incident Timeline */}
                  <div>
                    <h4 className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase pb-4 mb-6 border-b border-zinc-800">Incident Timeline</h4>
                    <div className="space-y-6">
                      <div className="flex gap-6">
                        <div className="text-[10px] font-mono text-zinc-500 pt-1">00:00:01</div>
                        <div>
                          <div className="text-xs font-mono text-zinc-300">Attempt</div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-1">Malicious payload injected</div>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-[10px] font-mono text-zinc-500 pt-1">00:00:02</div>
                        <div>
                          <div className="text-xs font-mono text-red-400">Detection</div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-1">Detected by {incident.detectionLayer}</div>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-[10px] font-mono text-zinc-500 pt-1">00:00:03</div>
                        <div>
                          <div className="text-xs font-mono text-red-400">Block</div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-1">Halted at {incident.blockedLayer}</div>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-[10px] font-mono text-zinc-500 pt-1">00:00:04</div>
                        <div>
                          <div className="text-xs font-mono text-emerald-500">Policy Enforcement</div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-1">Access permanently revoked</div>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-[10px] font-mono text-zinc-500 pt-1">00:00:05</div>
                        <div>
                          <div className="text-xs font-mono text-emerald-500">Audit</div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-1">Evidence hashed and anchored</div>
                        </div>
                      </div>
                      {isContained && (
                        <div className="flex gap-6">
                          <div className="text-[10px] font-mono text-emerald-500 pt-1">00:00:06</div>
                          <div>
                            <div className="text-xs font-mono text-emerald-500">Containment</div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">Threat contained by SOC</div>
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
