import { SeverityLevel, FindingStatus, ScanStatus } from '../../types';

export interface SentinelScanResult {
  id: string;
  triggeredBy: string;
  status: ScanStatus;
  passedCount: number;
  failedCount: number;
  startedAt: Date;
  completedAt: Date | null;
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
}

export type SecurityCheckFn = (ctx: SecurityCheckContext) => Promise<SentinelFinding | null>;
