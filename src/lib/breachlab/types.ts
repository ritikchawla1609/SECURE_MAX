import { SeverityLevel, UserRole } from '@/types';

export enum BreachLabRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
  NOT_RUN = 'NOT_RUN',
}

export enum ScenarioCategory {
  ACCESS_CONTROL = 'ACCESS_CONTROL',
  CRYPTOGRAPHY = 'CRYPTOGRAPHY',
  KEY_MANAGEMENT = 'KEY_MANAGEMENT',
  BLOCKCHAIN = 'BLOCKCHAIN',
  AUDIT_INTEGRITY = 'AUDIT_INTEGRITY',
  DEVICE_TRUST = 'DEVICE_TRUST',
  STORAGE_INTEGRITY = 'STORAGE_INTEGRITY',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
}

export enum ControlStatus {
  SATISFIED = 'SATISFIED',
  VIOLATED = 'VIOLATED',
  ERROR = 'ERROR',
  SKIPPED = 'SKIPPED',
}

export interface SecurityControlCheck {
  controlId: string;
  name: string;
  layer: 'KMS' | 'CRYPTO' | 'RBAC' | 'DATABASE' | 'BLOCKCHAIN' | 'AUDIT' | 'DEVICE_SESSION' | 'STORAGE';
  expectedBehavior: string;
  observedBehavior: string;
  status: ControlStatus;
}

export interface SanitizedEvidence {
  id: string;
  timestamp: string;
  category: 'EXCEPTION' | 'AUDIT_HASH' | 'CRYPTO_DIFF' | 'TOKEN_METADATA' | 'ORACLE_STATUS' | 'STORAGE_STATE';
  title: string;
  description: string;
  details: Record<string, any>;
  redactionsApplied: string[];
}

export interface ScenarioDefinition {
  id: string;
  scenarioNumber: number;
  title: string;
  version: string;
  category: ScenarioCategory;
  severity: SeverityLevel;
  cweId: string;
  threatModel: string;
  description: string;
  preconditions: string[];
  requiredFixtures: string[];
  steps: string[];
  expectedSecurityBehavior: string;
  safetyConstraints: string[];
  remediationGuidance: string;
}

export interface BreachLabScenarioResult {
  scenarioId: string;
  scenarioTitle: string;
  category: ScenarioCategory;
  severity: SeverityLevel;
  cweId: string;
  status: BreachLabRunStatus;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  expectedOutcome: string;
  actualOutcome: string;
  controlsExercised: SecurityControlCheck[];
  sanitizedEvidence: SanitizedEvidence[];
  sentinelEventIds: string[];
  sentinelIncidentId?: string;
  remediation: string;
  cleanupStatus: 'COMPLETED' | 'FAILED' | 'NOT_REQUIRED';
  cleanupDetails: string;
  errorDetails?: string;
}

export interface BreachLabRun {
  id: string;
  title: string;
  environment: 'sandbox' | 'test-isolated';
  initiatedBy: {
    userId: string;
    email?: string;
    name?: string;
    role: UserRole;
  };
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  status: BreachLabRunStatus;
  scenarioIds: string[];
  summary: {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    error: number;
    cancelled: number;
    notRun: number;
  };
  results: BreachLabScenarioResult[];
  sentinelScanId?: string;
  sentinelIncidentIds: string[];
  metadata: {
    kmsConfigured: boolean;
    blockchainRpcConfigured: boolean;
    auditAnchorConfigured: boolean;
    platformVersion: string;
  };
}

export interface BreachLabComparison {
  runA: { id: string; startedAt: string; status: BreachLabRunStatus };
  runB: { id: string; startedAt: string; status: BreachLabRunStatus };
  newlyFailing: string[];
  newlyPassing: string[];
  unchangedPassing: string[];
  unchangedFailing: string[];
  coverageDelta: {
    scenariosDelta: number;
    passedDelta: number;
    failedDelta: number;
    durationDeltaMs: number;
  };
  scenarioComparisons: Array<{
    scenarioId: string;
    scenarioTitle: string;
    statusA: BreachLabRunStatus;
    statusB: BreachLabRunStatus;
    durationA: number;
    durationB: number;
  }>;
}

export interface SentinelCorrelatedIncident {
  id: string;
  runId: string;
  scenarioId: string;
  title: string;
  severity: SeverityLevel;
  layer: string;
  status: 'CONTAINED' | 'MITIGATED' | 'BLOCKED' | 'FLAGGED';
  timestamp: string;
  attackPath: Array<{
    gate: string;
    status: 'PASSED' | 'BLOCKED';
    latencyMs?: number;
  }>;
  milestones: Array<{
    timeOffsetSec: number;
    label: string;
    description: string;
    state: 'ATTEMPT' | 'DETECTION' | 'BLOCK' | 'POLICY' | 'AUDIT' | 'CONTAINMENT';
  }>;
}
