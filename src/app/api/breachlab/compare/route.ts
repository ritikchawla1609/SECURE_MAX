import { NextResponse } from 'next/server';
import { compareBreachLabRuns } from '@/lib/breachlab/orchestrator';

/**
 * GET /api/breachlab/compare?runA=...&runB=...
 * Compares two runs scenario-by-scenario.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runIdA = searchParams.get('runA');
    const runIdB = searchParams.get('runB');

    if (!runIdA || !runIdB) {
      return NextResponse.json(
        { success: false, error: 'Both query parameters "runA" and "runB" are required' },
        { status: 400 }
      );
    }

    const comparison = compareBreachLabRuns(runIdA, runIdB);

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Comparison failed' },
      { status: 500 }
    );
  }
}
