'use client';

import { useEffect, useRef } from 'react';

/**
 * useRealtimeSync:
 * Subscribes to real-time events via Server-Sent Events (/api/events)
 * AND performs background polling every `intervalMs` (default 2500ms).
 * Also immediately triggers on window focus / visibility change.
 */
export function useRealtimeSync(onUpdate: () => void | Promise<void>, intervalMs: number = 2500) {
  const updateRef = useRef(onUpdate);
  updateRef.current = onUpdate;
  const inFlightRef = useRef(false);
  const pendingRerunRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const triggerUpdate = async () => {
      if (!isMounted) return;

      if (inFlightRef.current) {
        pendingRerunRef.current = true;
        return;
      }

      inFlightRef.current = true;
      pendingRerunRef.current = false;

      try {
        const res = updateRef.current();
        if (res && typeof (res as any).then === 'function') {
          await res;
        }
      } catch (err) {
        console.error('[RealtimeSync] Update error:', err);
      } finally {
        inFlightRef.current = false;
        if (pendingRerunRef.current && isMounted) {
          pendingRerunRef.current = false;
          setTimeout(triggerUpdate, 50);
        }
      }
    };

    // 1. Setup Server-Sent Events for instant notification (<100ms)
    let eventSource: EventSource | null = null;
    try {
      if (typeof window !== 'undefined' && window.EventSource) {
        eventSource = new EventSource('/api/events');
        eventSource.addEventListener('change', () => {
          triggerUpdate();
        });
        eventSource.onerror = () => {
          // SSE connection drop; fallback polling continues seamlessly
        };
      }
    } catch {
      // EventSource error/unsupported; polling provides guaranteed fallback
    }

    // 2. Setup periodic background polling (default 2500ms)
    const interval = setInterval(triggerUpdate, intervalMs);

    // 3. Setup window focus / visibility sync
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerUpdate();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', triggerUpdate);

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', triggerUpdate);
    };
  }, [intervalMs]);
}
