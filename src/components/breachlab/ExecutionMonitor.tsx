'use client';

import * as React from 'react';
import {
  RotateCw,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Terminal,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BreachLabRun, BreachLabRunStatus } from '@/lib/breachlab/types';

interface ExecutionMonitorProps {
  run: BreachLabRun;
  onCancelRun: (runId: string) => void;
  onViewResults: (runId: string) => void;
  isCancelling: boolean;
}

export function ExecutionMonitor({
  run,
  onCancelRun,
  onViewResults,
  isCancelling,
}: ExecutionMonitorProps) {
  const [elapsedMs, setElapsedMs] = React.useState<number>(run.durationMs || 0);

  // Live elapsed time ticker if running
  React.useEffect(() => {
    if (run.status === BreachLabRunStatus.RUNNING || run.status === BreachLabRunStatus.QUEUED) {
      const startTime = new Date(run.startedAt).getTime();
      const interval = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setElapsedMs(run.durationMs || 0);
    }
  }, [run.status, run.startedAt, run.durationMs]);

  const totalScenarios = run.summary.total || 10;
  const completedScenarios = run.results.length;
  const progressPercent =
    totalScenarios > 0 ? Math.round((completedScenarios / totalScenarios) * 100) : 0;

  const currentScenario =
    run.results.length < totalScenarios
      ? `Scenario ${completedScenarios + 1} of ${totalScenarios}`
      : 'All scenarios evaluated';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Execution Status Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-blue-400 font-semibold">
                {run.id}
              </span>
              <Badge
                className={
                  run.status === BreachLabRunStatus.RUNNING
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse text-xs'
                    : run.status === BreachLabRunStatus.PASSED
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs'
                }
              >
                {run.status === BreachLabRunStatus.RUNNING ? (
                  <span className="flex items-center gap-1.5">
                    <RotateCw className="h-3 w-3 animate-spin" />
                    RUNNING TESTS
                  </span>
                ) : (
                  run.status
                )}
              </Badge>
            </div>
            <h2 className="text-xl font-semibold text-slate-100">{run.title}</h2>
          </div>

          <div className="flex items-center gap-3">
            {run.status === BreachLabRunStatus.RUNNING ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCancelRun(run.id)}
                disabled={isCancelling}
                className="border-rose-800/60 bg-rose-950/20 text-rose-400 hover:bg-rose-900/30 text-xs"
              >
                <AlertOctagon className="h-3.5 w-3.5 mr-1.5" />
                {isCancelling ? 'Cancelling...' : 'Cancel Run'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onViewResults(run.id)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                View Full Results & Evidence
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar & KPIs */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-300">
            <span>
              Execution Progress: <strong className="text-slate-100">{completedScenarios} / {totalScenarios} Scenarios</strong>
            </span>
            <span className="font-mono text-blue-400">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-blue-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Realtime KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Elapsed Time</span>
            <span className="text-sm font-bold font-mono text-slate-200 mt-1 block">
              {(elapsedMs / 1000).toFixed(2)}s
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Defenses Verified</span>
            <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">
              {run.summary.passed} Passed
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Violations</span>
            <span className="text-sm font-bold font-mono text-rose-400 mt-1 block">
              {run.summary.failed} Failed
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Target Sandbox</span>
            <span className="text-sm font-bold font-mono text-blue-400 mt-1 block uppercase">
              {run.environment}
            </span>
          </div>
        </div>
      </div>

      {/* Live Event Log Stream */}
      <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
        <CardHeader className="p-5 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-blue-400" />
            Adversarial Test Stream & Telemetry
          </CardTitle>
          <span className="text-xs text-slate-500 font-mono">
            {run.results.length} events logged
          </span>
        </CardHeader>
        <CardContent className="p-5 space-y-3 font-mono text-xs">
          {run.results.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <RotateCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-600" />
              Initializing synthetic test fixtures and launching first scenario...
            </div>
          ) : (
            run.results.map((res, i) => (
              <div
                key={res.scenarioId}
                className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/50 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-slate-500 text-[11px]">[{i + 1}]</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 font-semibold">{res.scenarioId}</span>
                      <span className="text-slate-200 font-sans text-xs">
                        {res.scenarioTitle}
                      </span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs mt-1">
                      {res.actualOutcome}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{res.durationMs}ms</span>
                  <Badge
                    className={
                      res.status === BreachLabRunStatus.PASSED
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }
                  >
                    {res.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
