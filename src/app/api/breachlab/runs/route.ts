import { NextResponse } from 'next/server';
import { getVerifiedSession } from '@/lib/auth/session';
import { getAllBreachLabRuns, executeBreachLabRun } from '@/lib/breachlab/orchestrator';
import { UserRole } from '@/types';

/**
 * GET /api/breachlab/runs
 * Retrieves all BreachLab runs in reverse chronological order.
 */
export async function GET() {
  try {
    const runs = getAllBreachLabRuns();
    return NextResponse.json({
      success: true,
      total: runs.length,
      runs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list runs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/breachlab/runs
 * Initiates an adversarial test execution run.
 * Body: { scenarioIds?: string[], environment?: 'sandbox' | 'test-isolated', title?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { scenarioIds, environment, title } = body;

    let initiator = {
      userId: 'usr_sec_operator',
      email: 'secops@securemax.mil',
      name: 'Security Operations Engineer',
      role: UserRole.ADMIN,
    };

    const session = await getVerifiedSession().catch(() => null);
    if (session) {
      // Ensure user has security operator or admin rights
      if (session.role !== UserRole.ADMIN && session.role !== UserRole.SECURITY_ANALYST) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Insufficient privileges to launch BreachLab executions' },
          { status: 403 }
        );
      }
      initiator = {
        userId: session.userId,
        email: session.email || 'secops@securemax.mil',
        name: session.name || 'Security Operations Engineer',
        role: session.role,
      };
    }

    const run = await executeBreachLabRun({
      scenarioIds,
      environment: environment || 'sandbox',
      title,
      user: initiator,
    });

    return NextResponse.json({
      success: true,
      run,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start BreachLab run' },
      { status: 500 }
    );
  }
}
