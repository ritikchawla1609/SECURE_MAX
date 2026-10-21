import { deviceStore } from '@/lib/auth/deviceStore';
import { NextRequest } from 'next/server';
import { storeEvents } from '@/lib/auth/deviceStore';
import { getVerifiedSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  try {
    const session = await getVerifiedSession().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const { type, description, severity, assetId } = body;

    const event = await deviceStore.recordAuditEvent({
      eventType: type || 'SUSPICIOUS_ACTIVITY_REPORTED',
      description: description || 'Suspicious user or device activity manually flagged',
      userEmail: session?.email || 'operator@securemax.mil',
      userName: session?.name || 'Authorized Operator',
      targetId: assetId || session?.userId || 'User-Identity-Telemetry',
      severity: severity || 'WARNING',
    });

    storeEvents.emit('change', {
      type: 'SECURITY_INCIDENT_REPORTED',
      data: event,
      timestamp: Date.now(),
    });

    if (deviceStore?.lastSyncPromise) {
      await deviceStore.lastSyncPromise;
    }

    return Response.json({ success: true, event });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to record event' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (typeof deviceStore !== 'undefined') {
    await deviceStore.loadFromCloud();
  }
  
  if (deviceStore) {
    await deviceStore.loadFromCloud();
  }
  const encoder = new TextEncoder();

  let listener: ((event: any) => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`)
      );

      // Listen for change events from deviceStore
      listener = (change: any) => {
        try {
          controller.enqueue(
            encoder.encode(`event: change\ndata: ${JSON.stringify(change || {})}\n\n`)
          );
        } catch {
          // Stream closed or error
        }
      };
      storeEvents.on('change', listener);

      // Keepalive heartbeat every 15 seconds
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`)
          );
        } catch {
          // Stream closed
        }
      }, 15000);

      // Clean up on abort signal
      req.signal.addEventListener('abort', () => {
        if (listener) storeEvents.off('change', listener);
        if (heartbeat) clearInterval(heartbeat);
      });
    },
    cancel() {
      if (listener) storeEvents.off('change', listener);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
