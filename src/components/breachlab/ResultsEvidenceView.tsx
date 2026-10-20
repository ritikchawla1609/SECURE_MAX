'use client';

import * as React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Database,
  Lock,
  Code,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BreachLabRun,
  BreachLabRunStatus,
  BreachLabScenarioResult,
  ControlStatus,
} from '@/lib/breachlab/types';

interface ResultsEvidenceViewProps {
  run: BreachLabRun;
  onExport: (format: 'json' | 'markdown') => void;
  onNavigateToSentinel: () => void;
  onBackToOverview: () => void;
}

export function ResultsEvidenceView({
  run,
  onExport,
  onNavigateToSentinel,
  onBackToOverview,
}: ResultsEvidenceViewProps) {
  const [filter, setFilter] = React.useState<'ALL' | 'PASSED' | 'FAILED'>('ALL');
  const [expandedScenarios, setExpandedScenarios] = React.useState<Record<string, boolean>>({
    [run.results[0]?.scenarioId || '']: true,
  });

  const toggleExpand = (scenarioId: string) => {
    setExpandedScenarios((prev) => ({
      ...prev,
      [scenarioId]: !prev[scenarioId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    run.results.forEach((r) => {
      all[r.scenarioId] = true;
    });
    setExpandedScenarios(all);
  };

  const collapseAll = () => setExpandedScenarios({});

  const filteredResults = run.results.filter((res) => {
    if (filter === 'PASSED') return res.status === BreachLabRunStatus.PASSED;
    if (filter === 'FAILED') return res.status === BreachLabRunStatus.FAILED;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
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
              <span className="font-mono text-xs text-blue-400 font-semibold">{run.id}</span>
              <Badge
                className={
                  run.status === BreachLabRunStatus.PASSED
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }
              >
                {run.status === BreachLabRunStatus.PASSED ? 'ZERO DEFECTS' : 'ACTION REQUIRED'}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Security Evidence & Verification Report
            </h1>
            <p className="text-xs text-slate-400">
              {run.title} &bull; Executed on {new Date(run.startedAt).toLocaleString()} ({run.environment})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport('markdown')}
              className="border-slate-700 bg-slate-800/60 text-slate-300 text-xs hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport('json')}
              className="border-slate-700 bg-slate-800/60 text-slate-300 text-xs hover:bg-slate-800"
            >
              <Code className="h-3.5 w-3.5 mr-1.5" />
              Export JSON
            </Button>
            <Button
              size="sm"
              onClick={onNavigateToSentinel}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
              View Sentinel Incidents
            </Button>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Evaluated</span>
            <span className="text-xl font-bold font-mono text-slate-100">
              {run.summary.total} Scenarios
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Defenses Verified</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {run.summary.passed} Passed
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Violations Found</span>
            <span className="text-xl font-bold font-mono text-rose-400">
              {run.summary.failed} Failed
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-500 block uppercase">Duration</span>
            <span className="text-xl font-bold font-mono text-blue-400">
              {run.durationMs}ms
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['ALL', 'PASSED', 'FAILED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab === 'ALL'
                ? `All Scenarios (${run.results.length})`
                : tab === 'PASSED'
                ? `Passed (${run.summary.passed})`
                : `Failed (${run.summary.failed})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button
            onClick={expandAll}
            className="hover:text-slate-200 underline underline-offset-2"
          >
            Expand All
          </button>
          <span>&bull;</span>
          <button
            onClick={collapseAll}
            className="hover:text-slate-200 underline underline-offset-2"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Scenario-by-Scenario Evidence List */}
      <div className="space-y-4">
        {filteredResults.map((result) => {
          const isExpanded = Boolean(expandedScenarios[result.scenarioId]);
          const isPassed = result.status === BreachLabRunStatus.PASSED;

          return (
            <Card
              key={result.scenarioId}
              className={`border transition-all ${
                isPassed ? 'border-slate-800 bg-slate-900/80' : 'border-rose-900/50 bg-rose-950/10'
              }`}
            >
              {/* Scenario Header */}
              <div
                onClick={() => toggleExpand(result.scenarioId)}
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/20 transition-colors select-none"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isPassed
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isPassed ? '✓' : '✕'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {result.scenarioId}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-400 font-mono"
                      >
                        {result.cweId}
                      </Badge>
                      <Badge
                        className={
                          result.severity === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px]'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]'
                        }
                      >
                        {result.severity}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Category: <span className="text-slate-300">{result.category}</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 mt-1">
                      {result.scenarioTitle}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-slate-500 hidden sm:inline">
                    {result.durationMs}ms
                  </span>
                  <Badge
                    className={
                      isPassed
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }
                  >
                    {isPassed ? 'CONTROL HELD (PASSED)' : 'DEFECT DETECTED'}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Collapsible Details */}
              {isExpanded && (
                <CardContent className="p-5 pt-0 border-t border-slate-800/80 space-y-5 text-xs">
                  {/* Expected vs Actual */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Expected Security Invariant
                      </span>
                      <p className="text-slate-300 leading-relaxed font-sans">
                        {result.expectedOutcome}
                      </p>
                    </div>

                    <div
                      className={`p-3.5 rounded-lg border space-y-1 ${
                        isPassed
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                      }`}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Observed Execution Defense
                      </span>
                      <p className="leading-relaxed font-sans">{result.actualOutcome}</p>
                    </div>
                  </div>

                  {/* Evaluated Defensive Controls */}
                  {result.controlsExercised.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Exercised Runtime Controls ({result.controlsExercised.length})
                      </span>
                      <div className="space-y-2">
                        {result.controlsExercised.map((ctl) => (
                          <div
                            key={ctl.controlId}
                            className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-400">
                                  {ctl.controlId}
                                </span>
                                <span className="font-medium text-slate-200">
                                  {ctl.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-slate-700 text-slate-400 uppercase"
                                >
                                  {ctl.layer}
                                </Badge>
                              </div>
                              <p className="text-slate-400 mt-1">
                                <span className="text-slate-500">Observed: </span>
                                {ctl.observedBehavior}
                              </p>
                            </div>

                            <Badge
                              className={
                                ctl.status === ControlStatus.SATISFIED
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }
                            >
                              {ctl.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sanitized Cryptographic & Security Evidence */}
                  {result.sanitizedEvidence.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Sanitized Cryptographic Evidence References ({result.sanitizedEvidence.length})
                      </span>
                      <div className="space-y-2">
                        {result.sanitizedEvidence.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]"
                          >
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="font-semibold text-slate-200">{ev.title}</span>
                              <Badge
                                variant="outline"
                                className="text-[10px] border-slate-700 text-slate-400"
                              >
                                {ev.category}
                              </Badge>
                            </div>
                            <p className="text-slate-400 font-sans text-xs">
                              {ev.description}
                            </p>
                            {ev.redactionsApplied.length > 0 && (
                              <div className="text-[10px] text-amber-400/90 font-mono bg-amber-500/5 p-1.5 rounded border border-amber-500/20">
                                Redactions Enforced: {ev.redactionsApplied.join(' | ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remediation Guidance */}
                  {result.remediation && (
                    <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                        Defensive Architecture Remediation
                      </span>
                      <p className="text-slate-400 italic font-sans leading-relaxed">
                        {result.remediation}
                      </p>
                    </div>
                  )}

                  {/* Cleanup status */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <span>
                      Cleanup Posture:{' '}
                      <strong className="text-emerald-400">{result.cleanupStatus}</strong>
                    </span>
                    <span>Started: {new Date(result.startedAt).toLocaleTimeString()}</span>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
