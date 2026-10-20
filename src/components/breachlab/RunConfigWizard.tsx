'use client';

import * as React from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Shield,
  Layers,
  Database,
  Lock,
  Play,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SCENARIO_CATALOG } from '@/lib/breachlab/catalog';

interface RunConfigWizardProps {
  onStartRun: (config: {
    scenarioIds: string[];
    environment: 'sandbox' | 'test-isolated';
    title: string;
  }) => void;
  onCancel: () => void;
  isStarting: boolean;
}

export function RunConfigWizard({
  onStartRun,
  onCancel,
  isStarting,
}: RunConfigWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<number>(1);
  const [selectedScenarioIds, setSelectedScenarioIds] = React.useState<string[]>(
    SCENARIO_CATALOG.map((s) => s.id)
  );
  const [environment, setEnvironment] = React.useState<'sandbox' | 'test-isolated'>('sandbox');
  const [runTitle, setRunTitle] = React.useState<string>('Full Zero-Trust Defense Verification');

  const toggleScenario = (id: string) => {
    if (selectedScenarioIds.includes(id)) {
      if (selectedScenarioIds.length > 1) {
        setSelectedScenarioIds(selectedScenarioIds.filter((s) => s !== id));
      }
    } else {
      setSelectedScenarioIds([...selectedScenarioIds, id]);
    }
  };

  const selectAll = () => setSelectedScenarioIds(SCENARIO_CATALOG.map((s) => s.id));
  const deselectAll = () => setSelectedScenarioIds([SCENARIO_CATALOG[0].id]);

  const handleLaunch = () => {
    onStartRun({
      scenarioIds: selectedScenarioIds,
      environment,
      title: runTitle,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Wizard Step Indicator */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        {[
          { step: 1, title: '1. Select Scenarios' },
          { step: 2, title: '2. Environment' },
          { step: 3, title: '3. Limits & Review' },
          { step: 4, title: '4. Execute' },
        ].map((item) => (
          <div key={item.step} className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                currentStep === item.step
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                  : currentStep > item.step
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {currentStep > item.step ? '✓' : item.step}
            </div>
            <span
              className={`text-xs hidden sm:inline ${
                currentStep === item.step
                  ? 'text-slate-200 font-medium'
                  : 'text-slate-500'
              }`}
            >
              {item.title}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Select Scenarios */}
      {currentStep === 1 && (
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
          <CardHeader className="p-5 border-b border-slate-800 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-slate-100">
                Step 1: Choose Adversarial Scenarios
              </CardTitle>
              <p className="text-xs text-slate-400">
                Select which security invariants to test in this execution batch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="text-xs border-slate-700 h-7"
              >
                Select All ({SCENARIO_CATALOG.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                className="text-xs border-slate-700 h-7 text-slate-400"
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-2.5 max-h-[50vh] overflow-y-auto">
            {SCENARIO_CATALOG.map((s) => {
              const isSelected = selectedScenarioIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleScenario(s.id)}
                  className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-500/40 bg-blue-500/5'
                      : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/20 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-blue-400">{s.id}</span>
                        <span className="text-sm font-medium text-slate-200">
                          {s.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {s.description}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-slate-700 text-slate-400 font-mono"
                  >
                    {s.cweId}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Environment & Safety Notice */}
      {currentStep === 2 && (
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
          <CardHeader className="p-5 border-b border-slate-800">
            <CardTitle className="text-base font-semibold text-slate-100">
              Step 2: Confirm Isolated Test Sandbox
            </CardTitle>
            <p className="text-xs text-slate-400">
              Adversarial simulations execute against disposable synthetic fixtures only.
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 space-y-2 text-xs text-blue-200">
              <div className="flex items-center gap-2 font-semibold text-blue-300">
                <Shield className="h-4 w-4" />
                Zero-Impact Isolation Guarantee
              </div>
              <p>
                All test actions will be performed against synthetic user identities (e.g.{' '}
                <code className="text-blue-100 font-mono">breachlab_synthetic_usr_*</code>) and
                disposable cryptographic assets. Production files and real users are strictly untouched.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-medium text-slate-300 block">
                Target Execution Environment:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setEnvironment('sandbox')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                    environment === 'sandbox'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-800 bg-slate-950/40 opacity-70'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-200">Local Sandbox</div>
                  <div className="text-xs text-slate-400 mt-1">
                    In-memory KMS & database sandbox with automatic cleanup.
                  </div>
                </div>

                <div
                  onClick={() => setEnvironment('test-isolated')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                    environment === 'test-isolated'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-800 bg-slate-950/40 opacity-70'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-200">Isolated Cloud Stage</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Exercised with temporary test ledger rows and zeroization.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Limits & Plan Review */}
      {currentStep === 3 && (
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
          <CardHeader className="p-5 border-b border-slate-800">
            <CardTitle className="text-base font-semibold text-slate-100">
              Step 3: Review Execution Plan & Guardrails
            </CardTitle>
            <p className="text-xs text-slate-400">
              Verify concurrency constraints and execution parameters.
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-1">Scenarios Selected</span>
                <span className="text-base font-semibold text-slate-200 font-mono">
                  {selectedScenarioIds.length} of {SCENARIO_CATALOG.length}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-1">Per-Scenario Timeout</span>
                <span className="text-base font-semibold text-slate-200 font-mono">
                  5,000 ms
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-1">Evidence Redaction</span>
                <span className="text-base font-semibold text-emerald-400">
                  Strict Active
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block mb-1">Post-Test Cleanup</span>
                <span className="text-base font-semibold text-emerald-400">
                  Idempotent Auto-Purge
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium text-slate-300 block">
                Run Title or Label:
              </label>
              <input
                type="text"
                value={runTitle}
                onChange={(e) => setRunTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm and Launch */}
      {currentStep === 4 && (
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
          <CardHeader className="p-5 border-b border-slate-800">
            <CardTitle className="text-base font-semibold text-slate-100">
              Step 4: Confirm & Launch Execution
            </CardTitle>
            <p className="text-xs text-slate-400">
              Ready to execute adversarial simulations across SecureMAX security layers.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-5 text-center">
            <div className="h-14 w-14 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
              <Play className="h-7 w-7 fill-current ml-1" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-200">{runTitle}</h4>
              <p className="text-xs text-slate-400">
                Executing {selectedScenarioIds.length} scenarios in the isolated{' '}
                <span className="font-mono text-slate-300">{environment}</span> sandbox.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 max-w-md mx-auto">
              Real cryptographic operations (AES-256-GCM, P-256, Merkle verification, and fail-closed RPC logic) will be executed live to measure empirical defense efficacy.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wizard Footer Controls */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60">
        <Button
          variant="outline"
          size="sm"
          onClick={currentStep === 1 ? onCancel : () => setCurrentStep(currentStep - 1)}
          className="border-slate-700 text-slate-300 text-xs"
        >
          {currentStep === 1 ? 'Cancel' : 'Previous Step'}
        </Button>

        <div className="flex items-center gap-3">
          {currentStep < 4 ? (
            <Button
              size="sm"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              Continue
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleLaunch}
              disabled={isStarting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4"
            >
              {isStarting ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Initiating Run...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Launch Security Tests
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
