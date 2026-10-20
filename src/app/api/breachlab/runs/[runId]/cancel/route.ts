import { NextResponse } from 'next/server';
import { cancelBreachLabRun, getBreachLabRun } from '@/lib/breachlab/orchestrator';
import { getVerifiedSession } from '@/lib/auth/session';
import { UserRole } from '@/types';

/**
 * POST /api/breachlab/runs/[runId]/cancel
 * Requests graceful cancellation of an active or queued run.
 */
export async function POST(
  req: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;

    const session = await getVerifiedSession().catch(() => null);
    if (session && session.role !== UserRole.ADMIN && session.role !== UserRole.SECURITY_ANALYST) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient privileges to cancel runs' },
        { status: 403 }
      );
    }

    const cancelled = cancelBreachLabRun(runId);
    const run = getBreachLabRun(runId);

    return NextResponse.json({
      success: true,
      cancelled,
      runStatus: run?.status || 'UNKNOWN',
      message: cancelled
        ? `Cancellation request submitted for run '${runId}'`
        : `Run '${runId}' could not be cancelled (may have already completed or not found)`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel run' },
      { status: 500 }
    );
  }
}
