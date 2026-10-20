'use client';

import * as React from 'react';
import {
  Search,
  Filter,
  Shield,
  Lock,
  Database,
  Smartphone,
  Layers,
  ArrowRight,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SCENARIO_CATALOG } from '@/lib/breachlab/catalog';
import {
  ScenarioCategory,
  ScenarioDefinition,
  BreachLabRun,
  BreachLabRunStatus,
} from '@/lib/breachlab/types';

interface ScenarioCatalogViewProps {
  latestRun: BreachLabRun | null;
  onExecuteSingleScenario: (scenarioId: string) => void;
  onExecuteBatch: (scenarioIds: string[]) => void;
}

export function ScenarioCatalogView({
  latestRun,
  onExecuteSingleScenario,
  onExecuteBatch,
}: ScenarioCatalogViewProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('ALL');
  const [activeScenario, setActiveScenario] = React.useState<ScenarioDefinition | null>(null);

  // Category filters
  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: ScenarioCategory.ACCESS_CONTROL, label: 'Access Control' },
    { id: ScenarioCategory.CRYPTOGRAPHY, label: 'Cryptography (AES-GCM)' },
    { id: ScenarioCategory.KEY_MANAGEMENT, label: 'KMS Key Policy' },
    { id: ScenarioCategory.BLOCKCHAIN, label: 'Fail-Closed Blockchain' },
    { id: ScenarioCategory.AUDIT_INTEGRITY, label: 'Audit Hash Chaining' },
    { id: ScenarioCategory.DEVICE_TRUST, label: 'Device & Session Trust' },
    { id: ScenarioCategory.STORAGE_INTEGRITY, label: 'Storage Consistency' },
    { id: ScenarioCategory.PRIVILEGE_ESCALATION, label: 'Privilege Escalation' },
  ];

  // Filtered scenario list
  const filteredScenarios = SCENARIO_CATALOG.filter((scenario) => {
    const matchesCategory =
      selectedCategory === 'ALL' || scenario.category === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.cweId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const getLatestResult = (scenarioId: string) => {
    if (!latestRun) return null;
    return latestRun.results.find((r) => r.scenarioId === scenarioId) || null;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Adversarial Scenario Catalog
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic attack simulations exercising actual cryptographic, authorization, and fail-closed runtime controls.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => onExecuteBatch(filteredScenarios.map((s) => s.id))}
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-sm text-xs"
            >
              <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Run {filteredScenarios.length} Filtered Scenarios
            </Button>
          </div>
        </div>

        {/* Search input + Filter pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search by scenario title, description, or CWE ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/80 border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredScenarios.map((scenario) => {
          const lastResult = getLatestResult(scenario.id);
          const isPassed = lastResult?.status === BreachLabRunStatus.PASSED;

          return (
            <Card
              key={scenario.id}
              className="border-slate-800 bg-slate-900/80 text-slate-100 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {scenario.id}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-slate-700 text-slate-400 font-mono"
                      >
                        {scenario.cweId}
                      </Badge>
                      <Badge
                        className={
                          scenario.severity === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px]'
                            : scenario.severity === 'HIGH'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px]'
                        }
                      >
                        {scenario.severity}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-100 leading-snug pt-1">
                      {scenario.title}
                    </CardTitle>
                  </div>

                  {lastResult ? (
                    <Badge
                      className={
                        isPassed
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] whitespace-nowrap'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] whitespace-nowrap'
                      }
                    >
                      {isPassed ? 'BLOCKED' : 'VIOLATED'}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-slate-500 text-[10px] whitespace-nowrap"
                    >
                      NOT RUN
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                <p className="text-xs text-slate-400 line-clamp-2">
                  {scenario.description}
                </p>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                    Expected Invariant:
                  </span>
                  <p className="text-slate-300 font-sans text-xs">
                    {scenario.expectedSecurityBehavior}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-slate-500">
                    Category: <span className="text-slate-400">{scenario.category}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveScenario(scenario)}
                      className="text-xs text-slate-400 hover:text-slate-200 h-8"
                    >
                      Inspect Details
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onExecuteSingleScenario(scenario.id)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 h-8 text-xs border border-slate-700"
                    >
                      <Play className="h-3 w-3 mr-1.5 fill-current text-blue-400" />
                      Test Control
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Scenario Detail Modal / Drawer */}
      {activeScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 text-slate-100 shadow-xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-blue-400">
                    {activeScenario.id}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs border-slate-700 text-slate-400 font-mono"
                  >
                    {activeScenario.cweId}
                  </Badge>
                  <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs">
                    {activeScenario.severity}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {activeScenario.title}
                </h3>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveScenario(null)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Description & What Is Being Tested
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  {activeScenario.description}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Adversarial Threat Model
                </h4>
                <p className="text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  {activeScenario.threatModel}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Expected Security Invariant
                </h4>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 leading-relaxed">
                  {activeScenario.expectedSecurityBehavior}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Controlled Execution Steps
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  {activeScenario.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Required Synthetic Fixtures & Constraints
                </h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  {activeScenario.requiredFixtures.map((fix, idx) => (
                    <code
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono"
                    >
                      {fix}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                  Remediation & Defense Guidance
                </h4>
                <p className="text-slate-400 leading-relaxed italic bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  {activeScenario.remediationGuidance}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveScenario(null)}
                className="border-slate-700 text-slate-300"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const id = activeScenario.id;
                  setActiveScenario(null);
                  onExecuteSingleScenario(id);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Play className="h-3.5 w-3.5 mr-2 fill-current" />
                Run This Scenario
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
