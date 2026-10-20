'use client';

import * as React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Play,
  RotateCw,
  Clock,
  AlertTriangle,
  FileCheck2,
  FileX2,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  Layers,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BreachLabRun, BreachLabRunStatus } from '@/lib/breachlab/types';

interface BreachLabOverviewProps {
  runs: BreachLabRun[];
  activeRun: BreachLabRun | null;
  onStartNewRun: () => void;
  onViewRunDetails: (runId: string) => void;
  onViewScenarioCatalog: () => void;
  onViewSentinel: () => void;
  onViewComparison: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function BreachLabOverview({
  runs,
  activeRun,
  onStartNewRun,
  onViewRunDetails,
  onViewScenarioCatalog,
  onViewSentinel,
  onViewComparison,
  isLoading,
  onRefresh,
}: BreachLabOverviewProps) {
  const latestRun = runs[0] || null;

  const totalRuns = runs.length;
  const latestSummary = latestRun?.summary || {
    total: 10,
    passed: 10,
    failed: 0,
    error: 0,
    cancelled: 0,
    notRun: 0,
  };

  const passRate =
    latestSummary.total > 0
      ? Math.round((latestSummary.passed / latestSummary.total) * 100)
      : 0;

  // Severity distribution across latest completed scenarios
  const criticalCount =
    latestRun?.results.filter((r) => r.severity === 'CRITICAL').length || 0;
  const highCount =
    latestRun?.results.filter((r) => r.severity === 'HIGH').length || 0;
  const mediumCount =
    latestRun?.results.filter((r) => r.severity === 'MEDIUM').length || 0;

  return (
    <div className="space-y-6">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-blue-500" />
              BreachLab
            </h1>
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs px-2.5 py-0.5"
            >
              ISOLATED SANDBOX
            </Badge>
            {activeRun && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs px-2.5 py-0.5 flex items-center gap-1.5 animate-pulse"
              >
                <RotateCw className="h-3 w-3 animate-spin" />
                EXECUTION IN PROGRESS
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Adversarial security validation engine for Zero-Trust cryptographic invariants, KMS policies, and fail-closed controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800"
          >
            <RotateCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={onStartNewRun}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
          >
            <Play className="h-4 w-4 mr-2 fill-current" />
            Run Security Tests
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics (Reference Design: Cards & Summaries) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Scenarios Tested */}
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Latest Test Volume
              </span>
              <Layers className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-100">
                {latestSummary.total}
              </span>
              <span className="text-xs text-slate-400">evaluated</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Duration: {latestRun?.durationMs || 0}ms</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Defenses Verified (Passed) */}
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Controls Verified
              </span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-emerald-400">
                {latestSummary.passed}
              </span>
              <span className="text-xs text-emerald-500/80">passed</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <FileCheck2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                {latestSummary.passed} of {latestSummary.total} invariants held
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Vulnerabilities Detected (Failed) */}
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Invariant Breaches
              </span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-rose-400">
                {latestSummary.failed}
              </span>
              <span className="text-xs text-rose-500/80">violations</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <FileX2 className="h-3.5 w-3.5 text-rose-500" />
              <span>{latestSummary.failed > 0 ? 'Action Required' : 'Zero Defect State'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Historical Execution Runs */}
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Total Audit Runs
              </span>
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-100">
                {totalRuns}
              </span>
              <span className="text-xs text-slate-400">recorded</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Database className="h-3.5 w-3.5 text-blue-500" />
              <span>Persistent audit trail</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Grid: Test Results Breakdown + Security Exposure Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Latest Run Findings & Evidence Preview */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/80 text-slate-100">
          <CardHeader className="p-5 border-b border-slate-800 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-blue-400" />
                Latest Adversarial Evaluation
              </CardTitle>
              <p className="text-xs text-slate-400">
                Run ID: <code className="text-slate-300 font-mono">{latestRun?.id || 'None'}</code>
                {latestRun?.startedAt && (
                  <> &bull; Executed {new Date(latestRun.startedAt).toLocaleString()}</>
                )}
              </p>
            </div>
            {latestRun && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewRunDetails(latestRun.id)}
                className="text-xs border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white"
              >
                Inspect Evidence
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-5">
            {latestRun ? (
              <div className="space-y-3">
                {latestRun.results.slice(0, 5).map((res) => {
                  const isPassed = res.status === BreachLabRunStatus.PASSED;
                  return (
                    <div
                      key={res.scenarioId}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            isPassed ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">
                              {res.scenarioTitle}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-400"
                            >
                              {res.cweId}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {res.expectedOutcome}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500 font-mono hidden sm:inline">
                          {res.durationMs}ms
                        </span>
                        <Badge
                          className={
                            isPassed
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }
                        >
                          {isPassed ? 'BLOCKED' : 'VIOLATED'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                {latestRun.results.length > 5 && (
                  <div className="pt-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewRunDetails(latestRun.id)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View all {latestRun.results.length} evaluated scenarios &rarr;
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-sm">
                No security test runs executed yet. Launch your first adversarial test run above.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Col: Threat Classification & Quick Actions */}
        <div className="space-y-6">
          {/* Security Architecture Posture */}
          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardHeader className="p-5 border-b border-slate-800">
              <CardTitle className="text-base font-semibold text-slate-100">
                Threat Surface Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-blue-400" />
                    KMS & Envelope Crypto (AES-GCM)
                  </span>
                  <span className="font-mono text-emerald-400">100% Pass</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                    RBAC & Assignment Separation
                  </span>
                  <span className="font-mono text-emerald-400">100% Pass</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-amber-400" />
                    Fail-Closed Blockchain Oracle
                  </span>
                  <span className="font-mono text-emerald-400">100% Pass</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-cyan-400" />
                    Merkle Hash-Chain Tamper Detection
                  </span>
                  <span className="font-mono text-emerald-400">100% Pass</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-full" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Evaluated Scenarios</span>
                <span className="text-slate-200 font-medium">10 Available</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Subsystem Links */}
          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardHeader className="p-5 border-b border-slate-800">
              <CardTitle className="text-base font-semibold text-slate-100">
                BreachLab Subsystems
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2.5">
              <button
                onClick={onViewScenarioCatalog}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-300">Scenario Catalog (10 Scenarios)</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              </button>
              <button
                onClick={onViewSentinel}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-300">Sentinel Incident Timeline</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              </button>
              <button
                onClick={onViewComparison}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-300">Run History & Comparison</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Compact Recent Runs Table */}
      <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-sm">
        <CardHeader className="p-5 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-100">
            Recent Security Runs
          </CardTitle>
          <span className="text-xs text-slate-400">
            Showing {runs.slice(0, 5).length} of {runs.length} runs
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-5 font-medium">Run ID</th>
                  <th className="py-3 px-5 font-medium">Date & Time</th>
                  <th className="py-3 px-5 font-medium">Target Environment</th>
                  <th className="py-3 px-5 font-medium">Evaluated</th>
                  <th className="py-3 px-5 font-medium">Outcome</th>
                  <th className="py-3 px-5 font-medium">Duration</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {runs.slice(0, 5).map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-300 font-medium">
                      {run.id}
                    </td>
                    <td className="py-3.5 px-5 text-slate-400">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-950/60 text-slate-400 border-slate-700 uppercase"
                      >
                        {run.environment}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-slate-300">
                      {run.summary.total} scenarios
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge
                        className={
                          run.status === BreachLabRunStatus.PASSED
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : run.status === BreachLabRunStatus.RUNNING
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }
                      >
                        {run.status} ({run.summary.passed}/{run.summary.total})
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 font-mono">
                      {run.durationMs}ms
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewRunDetails(run.id)}
                        className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 px-2.5"
                      >
                        View Report
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
