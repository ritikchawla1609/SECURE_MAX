import { SeverityLevel, FindingStatus, ScanStatus } from '../../types';

export type ScenarioStatus =
  | "BLOCKED"
  | "VULNERABLE"
  | "ERROR"
  | "SKIPPED";

export interface ScenarioResult {
  scenarioId: string;
  scanId: string;
  environmentId: string;
  status: ScenarioStatus;
  startedAt: string;
  completedAt: string;
  expectedOutcome: string;
  actualOutcome: string;
  evidenceRefs: string[];
  remediation: string[];
  title: string;
  severity: SeverityLevel;
  category: string;
  durationMs: number;
  redactedEvidence?: Record<string, any>;
}

export interface SentinelScanResult {
  id: string;
  triggeredBy: string;
  status: ScanStatus;
  passedCount: number;
  failedCount: number;
  startedAt: Date;
  completedAt: Date | null;
  scenariosRun?: number;
  results?: ScenarioResult[];
}

export interface SentinelFinding {
  id: string;
  scanId: string;
  severity: SeverityLevel;
  component: string;
  attackType: string;
  title: string;
  description: string;
  evidence: string;
  impact: string;
  remediation: string;
  status: FindingStatus;
  timestamp: Date;
}

export interface SecurityCheckContext {
  scanId: string;
  sandboxUserId: string;
  sandboxAssetId: string;
  sandboxAdminId: string;
  environmentId?: string;
}

export interface SentinelExecutionContext extends SecurityCheckContext {
  environmentId: string;
  startedAt: string;
}

export type SecurityCheckFn = (ctx: SecurityCheckContext) => Promise<SentinelFinding | null>;

export interface SentinelScenarioDefinition {
  id: string; // S-01 through S-30
  title: string;
  category: string;
  severity: SeverityLevel;
  cweId?: string;
  description: string;
  expectedOutcome: string;
  remediation: string[];
  execute: (ctx: SentinelExecutionContext) => Promise<ScenarioResult>;
}
