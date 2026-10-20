import { NextResponse } from 'next/server';
import { exportBreachLabRun, getBreachLabRun } from '@/lib/breachlab/orchestrator';

/**
 * GET /api/breachlab/runs/[runId]/export?format=json|markdown
 * Exports sanitized run data or Markdown executive report.
 */
export async function GET(
  req: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get('format') || 'json') as 'json' | 'markdown';

    const run = getBreachLabRun(runId);
    if (!run) {
      return NextResponse.json(
        { success: false, error: `Run '${runId}' not found` },
        { status: 404 }
      );
    }

    const exported = exportBreachLabRun(runId, format);

    if (format === 'markdown') {
      return new Response(exported, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="breachlab-report-${runId}.md"`,
        },
      });
    }

    return new Response(exported, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="breachlab-run-${runId}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export run report' },
      { status: 500 }
    );
  }
}
