import { NextResponse } from 'next/server';
import { getBreachLabRun } from '@/lib/breachlab/orchestrator';

/**
 * GET /api/breachlab/runs/[runId]
 * Retrieves details and scenario results for a specific run.
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
        { success: false, error: `Run with ID '${runId}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      run,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve run details' },
      { status: 500 }
    );
  }
}
