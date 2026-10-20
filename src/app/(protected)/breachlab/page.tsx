'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Layers,
  Activity,
  FileText,
  GitCompare,
  RotateCw,
} from 'lucide-react';
import { BreachLabRun, BreachLabRunStatus } from '@/lib/breachlab/types';
import { BreachLabOverview } from '@/components/breachlab/BreachLabOverview';
import { ScenarioCatalogView } from '@/components/breachlab/ScenarioCatalogView';
import { RunConfigWizard } from '@/components/breachlab/RunConfigWizard';
import { ExecutionMonitor } from '@/components/breachlab/ExecutionMonitor';
import { ResultsEvidenceView } from '@/components/breachlab/ResultsEvidenceView';
import { SentinelInvestigationView } from '@/components/breachlab/SentinelInvestigationView';
import { RunHistoryComparisonView } from '@/components/breachlab/RunHistoryComparisonView';

function BreachLabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation tab state
  const [currentTab, setCurrentTab] = React.useState<
    'OVERVIEW' | 'CATALOG' | 'CONFIG' | 'MONITOR' | 'RESULTS' | 'SENTINEL' | 'COMPARE'
  >('OVERVIEW');

  // Core data state
  const [runs, setRuns] = React.useState<BreachLabRun[]>([]);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [inspectedRunId, setInspectedRunId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isStartingRun, setIsStartingRun] = React.useState<boolean>(false);
  const [isCancelling, setIsCancelling] = React.useState<boolean>(false);

  // Fetch runs on mount
  const fetchRuns = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/breachlab/runs');
      const data = await res.json();
      if (data.success && Array.isArray(data.runs)) {
        setRuns(data.runs);
        if (!inspectedRunId && data.runs.length > 0) {
          setInspectedRunId(data.runs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load BreachLab runs', err);
    } finally {
      setIsLoading(false);
    }
  }, [inspectedRunId]);

  React.useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Handle URL query parameters for direct tab navigation or run inspection
  React.useEffect(() => {
    const tabParam = searchParams.get('tab');
    const runParam = searchParams.get('runId');

    if (runParam) {
      setInspectedRunId(runParam);
      if (tabParam === 'sentinel') {
        setCurrentTab('SENTINEL');
      } else {
        setCurrentTab('RESULTS');
      }
    } else if (tabParam === 'catalog') {
      setCurrentTab('CATALOG');
    } else if (tabParam === 'compare') {
      setCurrentTab('COMPARE');
    }
  }, [searchParams]);

  // Polling active run if one is running
  React.useEffect(() => {
    if (!activeRunId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/breachlab/runs/${activeRunId}`);
        const data = await res.json();
        if (data.success && data.run) {
          // Update runs list
          setRuns((prev) =>
            prev.map((r) => (r.id === activeRunId ? data.run : r))
          );

          if (
            data.run.status !== BreachLabRunStatus.RUNNING &&
            data.run.status !== BreachLabRunStatus.QUEUED
          ) {
            setActiveRunId(null);
            setInspectedRunId(data.run.id);
            setCurrentTab('RESULTS');
          }
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [activeRunId]);

  // Start new run handler
  const handleStartRun = async (config: {
    scenarioIds?: string[];
    environment?: 'sandbox' | 'test-isolated';
    title?: string;
  }) => {
    setIsStartingRun(true);
    try {
      const res = await fetch('/api/breachlab/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success && data.run) {
        setRuns((prev) => [data.run, ...prev.filter((r) => r.id !== data.run.id)]);
        setInspectedRunId(data.run.id);

        if (data.run.status === BreachLabRunStatus.RUNNING) {
          setActiveRunId(data.run.id);
          setCurrentTab('MONITOR');
        } else {
          setCurrentTab('RESULTS');
        }
      } else {
        alert(data.error || 'Failed to start run');
      }
    } catch (err: any) {
      alert(err.message || 'Error initiating run');
    } finally {
      setIsStartingRun(false);
    }
  };

  // Single scenario execution handler
  const handleExecuteSingleScenario = (scenarioId: string) => {
    handleStartRun({
      scenarioIds: [scenarioId],
      environment: 'sandbox',
      title: `Single Scenario Test: ${scenarioId}`,
    });
  };

  // Cancel active run handler
  const handleCancelRun = async (runId: string) => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/breachlab/runs/${runId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        fetchRuns();
      }
    } catch (err) {
      console.error('Cancel error', err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Export report handler
  const handleExport = (format: 'json' | 'markdown') => {
    if (!inspectedRunId) return;
    window.open(`/api/breachlab/runs/${inspectedRunId}/export?format=${format}`, '_blank');
  };

  const inspectedRun = runs.find((r) => r.id === inspectedRunId) || runs[0] || null;
  const activeRun = runs.find((r) => r.id === activeRunId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setCurrentTab('OVERVIEW')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            currentTab === 'OVERVIEW'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Dashboard Overview
        </button>

        <button
          onClick={() => setCurrentTab('CATALOG')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            currentTab === 'CATALOG'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Scenario Catalog
        </button>

        {activeRun && (
          <button
            onClick={() => setCurrentTab('MONITOR')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              currentTab === 'MONITOR'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
            }`}
          >
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            Live Execution Monitor
          </button>
        )}

        {inspectedRun && (
          <button
            onClick={() => setCurrentTab('RESULTS')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              currentTab === 'RESULTS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Evidence & Results
          </button>
        )}

        {inspectedRun && (
          <button
            onClick={() => setCurrentTab('SENTINEL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              currentTab === 'SENTINEL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Sentinel Investigation
          </button>
        )}

        <button
          onClick={() => setCurrentTab('COMPARE')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            currentTab === 'COMPARE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <GitCompare className="h-3.5 w-3.5" />
          Run History & Comparison
        </button>
      </div>

      {/* Main Tab View Rendering */}
      {currentTab === 'OVERVIEW' && (
        <BreachLabOverview
          runs={runs}
          activeRun={activeRun}
          onStartNewRun={() => setCurrentTab('CONFIG')}
          onViewRunDetails={(runId) => {
            setInspectedRunId(runId);
            setCurrentTab('RESULTS');
          }}
          onViewScenarioCatalog={() => setCurrentTab('CATALOG')}
          onViewSentinel={() => setCurrentTab('SENTINEL')}
          onViewComparison={() => setCurrentTab('COMPARE')}
          isLoading={isLoading}
          onRefresh={fetchRuns}
        />
      )}

      {currentTab === 'CATALOG' && (
        <ScenarioCatalogView
          latestRun={inspectedRun}
          onExecuteSingleScenario={handleExecuteSingleScenario}
          onExecuteBatch={(scenarioIds) =>
            handleStartRun({
              scenarioIds,
              environment: 'sandbox',
              title: `Custom Batch (${scenarioIds.length} Scenarios)`,
            })
          }
        />
      )}

      {currentTab === 'CONFIG' && (
        <RunConfigWizard
          onStartRun={(cfg) => handleStartRun(cfg)}
          onCancel={() => setCurrentTab('OVERVIEW')}
          isStarting={isStartingRun}
        />
      )}

      {currentTab === 'MONITOR' && activeRun && (
        <ExecutionMonitor
          run={activeRun}
          onCancelRun={handleCancelRun}
          onViewResults={(runId) => {
            setInspectedRunId(runId);
            setCurrentTab('RESULTS');
          }}
          isCancelling={isCancelling}
        />
      )}

      {currentTab === 'RESULTS' && inspectedRun && (
        <ResultsEvidenceView
          run={inspectedRun}
          onExport={handleExport}
          onNavigateToSentinel={() => setCurrentTab('SENTINEL')}
          onBackToOverview={() => setCurrentTab('OVERVIEW')}
        />
      )}

      {currentTab === 'SENTINEL' && inspectedRun && (
        <SentinelInvestigationView
          run={inspectedRun}
          onBackToResults={() => setCurrentTab('RESULTS')}
        />
      )}

      {currentTab === 'COMPARE' && (
        <RunHistoryComparisonView
          runs={runs}
          onBackToOverview={() => setCurrentTab('OVERVIEW')}
          onViewRunDetails={(runId) => {
            setInspectedRunId(runId);
            setCurrentTab('RESULTS');
          }}
        />
      )}
    </div>
  );
}

export default function BreachLabPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center text-slate-400 font-mono text-sm">
          Loading BreachLab Security Command Center...
        </div>
      }
    >
      <BreachLabContent />
    </React.Suspense>
  );
}
