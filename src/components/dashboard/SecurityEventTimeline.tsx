'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';

interface TimelineEvent {
  time: string;
  title: string;
  category: string;
  status: string;
}

export function SecurityEventTimeline() {
  const { incidents, systemState, attackPathStage } = useDemoStore();
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    const now = new Date();
    const fmt = (offset: number) => {
      const d = new Date(now.getTime() - offset * 1000);
      return d.toLocaleTimeString('en-US', { hour12: false });
    };

    if (systemState === 'CONTAINMENT' || systemState === 'INCIDENT') {
      // During a security event, show the attack timeline
      setEvents([
        { time: fmt(0), title: 'INCIDENT CREATED', category: 'Threat Engine', status: 'BLOCKED' },
        { time: fmt(1), title: 'ACCESS DENIED AT DOMAIN 2', category: 'Key Security', status: 'DENIED' },
        { time: fmt(2), title: 'ABNORMAL PATTERN DETECTED', category: 'Threat Engine', status: 'ALERT' },
        { time: fmt(4), title: 'ASSET POLICY EVALUATED', category: 'Domain 1', status: '✓ PASSED' },
        { time: fmt(6), title: 'SESSION CONTEXT CHECKED', category: 'Authorization', status: '✓ PASSED' },
      ]);
    } else if (systemState === 'RECOVERED') {
      setEvents([
        { time: fmt(0), title: 'SECURITY FABRIC RESTORED', category: 'System', status: '✓ RECOVERED' },
        { time: fmt(2), title: 'THREAT CONTAINED', category: 'Threat Engine', status: '✓ RESOLVED' },
        { time: fmt(5), title: 'INCIDENT CREATED', category: 'Threat Engine', status: 'BLOCKED' },
        { time: fmt(6), title: 'ACCESS DENIED AT DOMAIN 2', category: 'Key Security', status: 'DENIED' },
        { time: fmt(8), title: 'ABNORMAL PATTERN DETECTED', category: 'Threat Engine', status: 'ALERT' },
      ]);
    } else {
      // Normal idle state — show system readiness events, NOT authorization outcomes
      setEvents([
        { time: fmt(0), title: 'KMS HEALTH CHECK', category: 'Key Security', status: '✓ OPERATIONAL' },
        { time: fmt(12), title: 'SECURITY SCAN COMPLETED', category: 'Threat Engine', status: '✓ CLEAR' },
        { time: fmt(30), title: 'AUDIT CHAIN VERIFIED', category: 'Audit', status: '✓ VERIFIED' },
        { time: fmt(45), title: 'DOMAIN 2 POLICY SYNC', category: 'Domain 2', status: '✓ READY' },
        { time: fmt(60), title: 'DOMAIN 1 POLICY SYNC', category: 'Domain 1', status: '✓ READY' },
      ]);
    }
  }, [systemState, incidents, attackPathStage]);

  return (
    <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg w-full">
      <CardHeader className="pb-4 pt-6 px-6 border-b border-zinc-800/50">
        <CardTitle className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          <Clock className="w-4 h-4 text-cyan-400" /> Security Event Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-stretch gap-4 relative">
           {/* Connecting Line for Desktop */}
           <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-zinc-800/50 -translate-y-1/2 z-0" />
           
           {events.map((evt, idx) => (
             <React.Fragment key={idx}>
               <div className="flex flex-col items-center text-center z-10 bg-[#0a0a0c] px-2 flex-1 min-w-0">
                 <span className="text-[10px] font-mono text-zinc-500 mb-2">{evt.time}</span>
                 <div className={`w-2 h-2 rounded-full mb-2 ${
                   evt.status.includes('DENIED') || evt.status.includes('BLOCKED') ? 'bg-red-500/70' :
                   evt.status.includes('ALERT') ? 'bg-amber-500/70' :
                   'bg-cyan-500/50'
                 }`} />
                 <span className="text-[10px] font-bold font-mono tracking-widest text-zinc-100 uppercase mt-1 leading-tight">{evt.title}</span>
                 <span className="text-[9px] font-mono tracking-widest text-zinc-600 uppercase mt-1">{evt.category}</span>
                 <span className={`text-[8px] font-mono tracking-widest px-2 py-0.5 rounded mt-2 uppercase ${
                   evt.status.includes('VERIFIED') || evt.status.includes('PASSED') || evt.status.includes('OPERATIONAL') || evt.status.includes('READY') || evt.status.includes('CLEAR') || evt.status.includes('RECOVERED') || evt.status.includes('RESOLVED') ? 'bg-emerald-500/10 text-emerald-400' :
                   evt.status.includes('DENIED') || evt.status.includes('BLOCKED') ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                 }`}>
                   {evt.status}
                 </span>
               </div>
               {idx < events.length - 1 && (
                 <div className="hidden md:flex items-center text-zinc-700 z-10 bg-[#0a0a0c] px-1 font-mono text-xs">→</div>
               )}
             </React.Fragment>
           ))}
        </div>
      </CardContent>
    </Card>
  );
}
