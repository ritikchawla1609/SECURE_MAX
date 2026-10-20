import { NextResponse } from 'next/server';
import { SCENARIO_CATALOG } from '@/lib/breachlab/catalog';
import { ScenarioCategory } from '@/lib/breachlab/types';
import { SeverityLevel } from '@/types';

/**
 * GET /api/breachlab/scenarios
 * Returns the catalog of adversarial security testing scenarios.
 * Supports query params: ?category=ACCESS_CONTROL&severity=CRITICAL
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as ScenarioCategory | null;
    const severity = searchParams.get('severity') as SeverityLevel | null;

    let scenarios = [...SCENARIO_CATALOG];

    if (category) {
      scenarios = scenarios.filter((s) => s.category === category);
    }

    if (severity) {
      scenarios = scenarios.filter((s) => s.severity === severity);
    }

    return NextResponse.json({
      success: true,
      total: scenarios.length,
      scenarios,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve scenario catalog' },
      { status: 500 }
    );
  }
}
