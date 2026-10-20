'use client';

import * as React from 'react';
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BreachLabRun,
  BreachLabComparison,
  BreachLabRunStatus,
} from '@/lib/breachlab/types';

interface RunHistoryComparisonViewProps {
  runs: BreachLabRun[];
  onBackToOverview: () => void;
  onViewRunDetails: (runId: string) => void;
}

export function RunHistoryComparisonView({
  runs,
  onBackToOverview,
  onViewRunDetails,
}: RunHistoryComparisonViewProps) {
  const [selectedRunA, setSelectedRunA] = React.useState<string>(runs[0]?.id || '');
  const [selectedRunB, setSelectedRunB] = React.useState<string>(runs[1]?.id || runs[0]?.id || '');
  const [comparison, setComparison] = React.useState<BreachLabComparison | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  const fetchComparison = React.useCallback(async () => {
    if (!selectedRunA || !selectedRunB) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/breachlab/compare?runA=${encodeURIComponent(selectedRunA)}&runB=${encodeURIComponent(
          selectedRunB
        )}`
      );
      const data = await res.json();
      if (data.success && data.comparison) {
        setComparison(data.comparison);
      }
    } catch (err) {
      console.error('Failed to compare runs', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRunA, selectedRunB]);

  React.useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const runA = runs.find((r) => r.id === selectedRunA);
  const runB = runs.find((r) => r.id === selectedRunB);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToOverview}
                className="text-xs text-slate-400 hover:text-slate-200 h-7 px-2 -ml-2"
              >
                &larr; Overview
              </Button>
              <span className="text-slate-600">|</span>
              <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs">
                RUN COMPARISON
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <GitCompare className="h-6 w-6 text-purple-400" />
              Adversarial Run Comparison & Differential Analysis
            </h1>
            <p className="text-xs text-slate-400">
              Compare security invariant verification results and performance across runs.
            </p>
          </div>
        </div>

        {/* Selector dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Baseline Run (A):
            </label>
            <select
              value={selectedRunA}
              onChange={(e) => setSelectedRunA(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} &bull; {r.title} ({new Date(r.startedAt).toLocaleTimeString()})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Target Run (B):
            </label>
            <select
              value={selectedRunB}
              onChange={(e) => setSelectedRunB(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} &bull; {r.title} ({new Date(r.startedAt).toLocaleTimeString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Delta Metric Summary */}
      {comparison && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">
                Coverage Delta
              </span>
              <span className="text-2xl font-bold font-mono text-slate-200 mt-1 block">
                {comparison.coverageDelta.scenariosDelta >= 0 ? '+' : ''}
                {comparison.coverageDelta.scenariosDelta}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {runB?.summary.total} vs {runA?.summary.total} scenarios
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">
                Passed Delta
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {comparison.coverageDelta.passedDelta >= 0 ? '+' : ''}
                {comparison.coverageDelta.passedDelta}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {runB?.summary.passed} vs {runA?.summary.passed} passed
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">
                Failed Delta
              </span>
              <span className="text-2xl font-bold font-mono text-rose-400 mt-1 block">
                {comparison.coverageDelta.failedDelta >= 0 ? '+' : ''}
                {comparison.coverageDelta.failedDelta}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {runB?.summary.failed} vs {runA?.summary.failed} failed
              </span>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">
                Latency Delta
              </span>
              <span className="text-2xl font-bold font-mono text-blue-400 mt-1 block">
                {comparison.coverageDelta.durationDeltaMs >= 0 ? '+' : ''}
                {comparison.coverageDelta.durationDeltaMs}ms
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {runB?.durationMs}ms vs {runA?.durationMs}ms
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scenario-Level Comparison Table */}
      <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
        <CardHeader className="p-5 border-b border-slate-800">
          <CardTitle className="text-sm font-semibold text-slate-100">
            Scenario Outcome Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Calculating differential metrics...
            </div>
          ) : comparison ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-5 font-medium">Scenario</th>
                    <th className="py-3 px-5 font-medium font-mono">Run A Status</th>
                    <th className="py-3 px-5 font-medium font-mono">Run B Status</th>
                    <th className="py-3 px-5 font-medium">Outcome Shift</th>
                    <th className="py-3 px-5 font-medium text-right font-mono">Duration Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {comparison.scenarioComparisons.map((sc) => {
                    const statusChanged = sc.statusA !== sc.statusB;
                    return (
                      <tr key={sc.scenarioId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-mono text-blue-400 font-semibold">
                            {sc.scenarioId}
                          </div>
                          <div className="text-slate-300 font-medium mt-0.5">
                            {sc.scenarioTitle}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge
                            className={
                              sc.statusA === BreachLabRunStatus.PASSED
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }
                          >
                            {sc.statusA}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge
                            className={
                              sc.statusB === BreachLabRunStatus.PASSED
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }
                          >
                            {sc.statusB}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5">
                          {statusChanged ? (
                            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              STATUS CHANGED
                            </Badge>
                          ) : (
                            <span className="text-slate-500">Consistent</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-400">
                          {sc.durationB - sc.durationA >= 0 ? '+' : ''}
                          {sc.durationB - sc.durationA}ms
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500">
              Select two runs above to inspect differential analysis.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
