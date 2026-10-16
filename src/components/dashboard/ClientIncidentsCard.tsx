'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useDemoStore } from '@/stores/useDemoStore';

export function ClientIncidentsCard() {
  const { incidents } = useDemoStore();
  const openIncidentsCount = incidents.filter(i => i.status !== 'THREAT CONTAINED').length;

  return (
    <Card className="bg-[#0a0a0c] border-zinc-800 rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Active Incidents</CardTitle>
        {openIncidentsCount > 0 ? (
          <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`text-2xl font-mono ${openIncidentsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
          {openIncidentsCount}
        </div>
        {openIncidentsCount > 0 ? (
          <div className="mt-1">
            <p className="text-[10px] font-mono text-amber-500 tracking-widest uppercase">TOKEN REPLAY ATTEMPT</p>
            <p className="text-[9px] font-mono text-zinc-500 tracking-widest uppercase mt-0.5">DETECTED · BLOCKED</p>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-zinc-500 mt-1 tracking-widest uppercase">No Active Incidents</p>
        )}
      </CardContent>
    </Card>
  );
}
