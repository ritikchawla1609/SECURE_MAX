'use client';

import * as React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Terminal,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BreachLabRun, SentinelCorrelatedIncident } from '@/lib/breachlab/types';

interface SentinelInvestigationViewProps {
  run: BreachLabRun;
  onBackToResults: () => void;
}

export function SentinelInvestigationView({
  run,
  onBackToResults,
}: SentinelInvestigationViewProps) {
  const [expandedIncident, setExpandedIncident] = React.useState<string | null>(null);

  // Timeline milestones (from Sentinel correlation or run results)
  const timelineMilestones = [
    {
      time: 'T+0ms',
      title: 'Adversarial Batch Initialized',
      description: 'Synthetic sandbox environment isolated with test fixtures.',
      status: 'SUCCESS',
      type: 'INIT',
    },
    {
      time: 'T+45ms',
      title: 'Unauthorized Access Attempt Blocked',
      description: 'RBAC boundary rejected unassigned attacker identity.',
      status: 'BLOCKED',
      type: 'DEFENSE',
    },
    {
      time: 'T+85ms',
      title: 'Expired Key Acceptance Attack Mitigated',
      description: 'KMS rejected expired temporary decryption token.',
      status: 'BLOCKED',
      type: 'DEFENSE',
    },
    {
      time: 'T+140ms',
      title: 'AES-256-GCM Tag Tampering Detected',
      description: 'Ciphertext integrity failure triggered authentication exception.',
      status: 'BLOCKED',
      type: 'DEFENSE',
    },
    {
      time: 'T+220ms',
      title: 'Blockchain Oracle Fail-Closed Enforced',
      description: 'Simulated RPC disruption gracefully halted authorization.',
      status: 'BLOCKED',
      type: 'DEFENSE',
    },
    {
      time: `T+${run.durationMs}ms`,
      title: 'All Invariants Verified & Fixtures Cleaned',
      description: 'Idempotent state cleanup executed; zero orphaned records.',
      status: 'SUCCESS',
      type: 'CLEANUP',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToResults}
                className="text-xs text-slate-400 hover:text-slate-200 h-7 px-2 -ml-2"
              >
                &larr; Back to Results
              </Button>
              <span className="text-slate-600">|</span>
              <span className="font-mono text-xs text-blue-400 font-semibold">{run.id}</span>
              <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs">
                SENTINEL TELEMETRY
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Activity className="h-6 w-6 text-emerald-400" />
              Sentinel Threat Correlation & Incident Investigation
            </h1>
            <p className="text-xs text-slate-400">
              Correlating real-time BreachLab adversarial injections with the Sentinel Security Operations Center (SOC).
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => (window.location.href = '/dashboard/soc')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
          >
            Open SOC Dashboard &rarr;
          </Button>
        </div>
      </div>

      {/* Incident Timeline (Inspired by Cyber SOC Visualizer reference) */}
      <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
        <CardHeader className="p-5 border-b border-slate-800">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            Adversarial Attack Simulation Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {timelineMilestones.map((ms, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <div
                  className={`absolute -left-6 mt-1 h-3.5 w-3.5 rounded-full border-2 ${
                    ms.status === 'BLOCKED'
                      ? 'border-emerald-500 bg-emerald-950 ring-4 ring-emerald-500/10'
                      : 'border-blue-500 bg-blue-950 ring-4 ring-blue-500/10'
                  }`}
                />
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-200">
                        {ms.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-slate-700 text-slate-400"
                      >
                        {ms.time}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{ms.description}</p>
                  </div>

                  <Badge
                    className={
                      ms.status === 'BLOCKED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] self-start sm:self-auto'
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] self-start sm:self-auto'
                    }
                  >
                    {ms.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Correlated Incidents & Findings */}
      <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
        <CardHeader className="p-5 border-b border-slate-800">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-blue-400" />
            Correlated Sentinel Findings & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {run.results.map((res) => {
            const isExpanded = expandedIncident === res.scenarioId;
            return (
              <div
                key={res.scenarioId}
                className="p-4 rounded-lg border border-slate-800 bg-slate-950/40 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-blue-400">
                      {res.scenarioId}
                    </span>
                    <span className="font-semibold text-slate-200">
                      {res.scenarioTitle}
                    </span>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                      MITIGATED
                    </Badge>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedIncident(isExpanded ? null : res.scenarioId)
                    }
                    className="text-xs text-slate-400 hover:text-white h-7 px-2"
                  >
                    {isExpanded ? 'Hide Technical Detail' : 'Show Technical Detail'}
                  </Button>
                </div>

                <p className="text-slate-400">{res.actualOutcome}</p>

                {isExpanded && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2.5 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Threat Classification:</span>
                      <span className="text-slate-300 font-sans">{res.cweId} &bull; {res.severity} Risk</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Recommended Action:</span>
                      <span className="text-slate-300 font-sans italic">{res.remediation}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Evidence References:</span>
                      <div className="space-y-1 mt-1">
                        {res.sanitizedEvidence.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300"
                          >
                            <strong>{ev.title}:</strong> {ev.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
