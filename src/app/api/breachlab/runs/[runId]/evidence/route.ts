import { NextResponse } from 'next/server';
import { getBreachLabRun } from '@/lib/breachlab/orchestrator';

/**
 * GET /api/breachlab/runs/[runId]/evidence
 * Retrieves all sanitized cryptographic and security evidence collected during the run.
 */
export async function GET(
  req: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    const run = getBreachLabRun(runId);

    if (!run) {
      return NextResponse.json(
        { success: false, error: `Run '${runId}' not found` },
        { status: 404 }
      );
    }

    const evidenceByScenario = run.results.map((res) => ({
      scenarioId: res.scenarioId,
      scenarioTitle: res.scenarioTitle,
      category: res.category,
      status: res.status,
      controls: res.controlsExercised,
      evidence: res.sanitizedEvidence,
    }));

    return NextResponse.json({
      success: true,
      runId: run.id,
      environment: run.environment,
      totalEvidenceItems: run.results.reduce(
        (acc, r) => acc + r.sanitizedEvidence.length,
        0
      ),
      scenarios: evidenceByScenario,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve run evidence' },
      { status: 500 }
    );
  }
}
