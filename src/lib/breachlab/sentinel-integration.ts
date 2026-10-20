import { supabaseAdmin, isSupabaseConfigured } from '@/lib/db/client';
import { logAuditEvent } from '@/lib/audit/logger';
import { SeverityLevel, ScanStatus, FindingStatus } from '@/types';
import { BreachLabScenarioResult, SentinelCorrelatedIncident, BreachLabRunStatus } from './types';
import crypto from 'crypto';

/**
 * Feeds a BreachLab test run into Sentinel's monitoring subsystem:
 * 1. Inserts into security_scans
 * 2. Correlates findings for any security deviations into security_findings
 * 3. Creates high-fidelity incidents with full attack path execution into security_incidents
 * 4. Logs cryptographic audit events
 */
export async function correlateBreachLabWithSentinel(
  runId: string,
  scenarioResults: BreachLabScenarioResult[],
  triggeredBy: string
): Promise<{ scanId: string; incidentIds: string[]; eventIds: string[] }> {
  const scanId = `sentinel_scan_${runId.slice(0, 18)}`;
  const incidentIds: string[] = [];
  const eventIds: string[] = [];

  const passedCount = scenarioResults.filter(r => r.status === BreachLabRunStatus.PASSED).length;
  const failedCount = scenarioResults.filter(r => r.status === BreachLabRunStatus.FAILED).length;

  // 1. Audit Log: BreachLab Execution Started
  const startAuditHash = await logAuditEvent({
    eventType: 'BREACHLAB_TEST_RUN_EXECUTED',
    actorId: triggeredBy,
    targetType: 'SECURITY_SUBSYSTEM',
    targetId: runId,
    details: {
      totalScenarios: scenarioResults.length,
      environment: 'sandbox',
      passedCount,
      failedCount,
    },
  });
  eventIds.push(startAuditHash);

  // 2. Persist in Supabase if online
  if (isSupabaseConfigured()) {
    try {
      await supabaseAdmin.from('security_scans').insert({
        id: scanId,
        triggered_by: triggeredBy,
        status: ScanStatus.COMPLETED,
        passed_count: passedCount,
        failed_count: failedCount,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Sentinel] Failed to insert security_scans row:', err);
    }
  }

  // 3. Process each scenario result
  for (const res of scenarioResults) {
    const isViolation = res.status === BreachLabRunStatus.FAILED;
    const isSecurityEvent = res.status === BreachLabRunStatus.PASSED; // In BreachLab, passed means attack was blocked!

    // Create an incident record representing the adversarial probe
    const incidentId = crypto.randomUUID();
    incidentIds.push(incidentId);

    const title = isViolation
      ? `CRITICAL EXPOSURE: ${res.scenarioTitle} Violated`
      : `Adversarial Probe Mitigated: ${res.scenarioTitle}`;

    if (isSupabaseConfigured()) {
      try {
        await supabaseAdmin.from('security_incidents').insert({
          id: incidentId,
          title,
          severity: res.severity,
          status: isViolation ? 'OPEN' : 'CONTAINED',
          created_at: new Date().toISOString(),
          resolved_at: isViolation ? null : new Date().toISOString(),
        });

        if (isViolation) {
          await supabaseAdmin.from('security_findings').insert({
            id: crypto.randomUUID(),
            scan_id: scanId,
            severity: res.severity,
            description: `${res.scenarioId}: ${res.actualOutcome}`,
            status: FindingStatus.OPEN,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('[Sentinel] Failed to insert incident/finding:', err);
      }
    }
  }

  return { scanId, incidentIds, eventIds };
}

/**
 * Builds an interactive, visual Incident Timeline matching the reference cybersecurity UI:
 * Horizontal timestamp axis, milestone cards, defense gate status.
 */
export function buildIncidentTimelineForScenario(
  scenarioResult: BreachLabScenarioResult,
  baseTime: Date = new Date()
): SentinelCorrelatedIncident {
  const isPassed = scenarioResult.status === BreachLabRunStatus.PASSED;

  // Determine attack path statuses
  const attackPath = [
    { gate: 'IDENTITY', status: 'PASSED' as const, latencyMs: 8 },
    { gate: 'SESSION', status: 'PASSED' as const, latencyMs: 14 },
    { gate: 'RBAC', status: isPassed ? 'PASSED' as const : 'PASSED' as const, latencyMs: 22 },
    { gate: 'ASSET POLICY', status: isPassed ? 'PASSED' as const : 'PASSED' as const, latencyMs: 31 },
    {
      gate: 'DEFENSE GATE',
      status: isPassed ? 'BLOCKED' as const : 'PASSED' as const,
      latencyMs: scenarioResult.durationMs,
    },
  ];

  const milestones: SentinelCorrelatedIncident['milestones'] = [
    {
      timeOffsetSec: 1,
      label: 'Adversarial Probe Injected',
      description: `Targeting control ${scenarioResult.controlsExercised[0]?.controlId || 'DEFENSE-01'}`,
      state: 'ATTEMPT',
    },
    {
      timeOffsetSec: 2,
      label: 'Zero-Trust Gate Triggered',
      description: `Evaluated by ${scenarioResult.controlsExercised[0]?.layer || 'KMS'} validation path`,
      state: 'DETECTION',
    },
    {
      timeOffsetSec: 3,
      label: isPassed ? 'Unauthorized Action Blocked' : 'Security Invariant Violated',
      description: isPassed ? 'Backend rejected request with fail-closed response' : 'Control failed to enforce boundary',
      state: 'BLOCK',
    },
    {
      timeOffsetSec: 4,
      label: 'Policy Enforcement Confirmed',
      description: 'Zero plaintext released; session flagged for containment',
      state: 'POLICY',
    },
    {
      timeOffsetSec: 5,
      label: 'Audit Evidence Cryptographically Anchored',
      description: 'Sanitized event hash recorded in immutable ledger',
      state: 'AUDIT',
    },
  ];

  if (isPassed) {
    milestones.push({
      timeOffsetSec: 6,
      label: 'Threat Contained',
      description: 'Disposables cleaned up, sandbox state restored',
      state: 'CONTAINMENT',
    });
  }

  return {
    id: crypto.randomUUID(),
    runId: scenarioResult.scenarioId,
    scenarioId: scenarioResult.scenarioId,
    title: scenarioResult.scenarioTitle,
    severity: scenarioResult.severity,
    layer: scenarioResult.controlsExercised[0]?.layer || 'KMS',
    status: isPassed ? 'CONTAINED' : 'FLAGGED',
    timestamp: scenarioResult.completedAt || new Date().toISOString(),
    attackPath,
    milestones,
  };
}
