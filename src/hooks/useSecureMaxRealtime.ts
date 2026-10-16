'use client';

import * as React from 'react';

export interface RealtimeState {
  pendingRequests: any[];
  liveGrants: any[];
  notifications: any[];
  auditEvents: any[];
  stats: {
    identitiesCount: number;
    activeAssetsCount: number;
    pendingCount: number;
    openIncidentsCount: number;
  };
  timestamp: number;
}

export function useSecureMaxRealtime(initialSync: boolean = true) {
  const [data, setData] = React.useState<RealtimeState | null>(null);
  const [channel, setChannel] = React.useState<BroadcastChannel | null>(null);

  const fetchState = React.useCallback(async () => {
    try {
      const res = await fetch('/api/sync/state', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(prev => {
            if (!prev) return json;
            const p = {
              pendingRequests: prev.pendingRequests,
              liveGrants: prev.liveGrants,
              notifications: prev.notifications,
              auditEvents: prev.auditEvents,
              stats: prev.stats,
            };
            const n = {
              pendingRequests: json.pendingRequests,
              liveGrants: json.liveGrants,
              notifications: json.notifications,
              auditEvents: json.auditEvents,
              stats: json.stats,
            };
            if (JSON.stringify(p) === JSON.stringify(n)) {
              return prev; // Retain reference to prevent re-renders & blinking
            }
            return json;
          });
        }
      }
    } catch (err) {
      // silent fail in offline mode
    }
  }, []);

  const broadcastUpdate = React.useCallback((type: string, payload?: any) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('securemax_realtime');
        bc.postMessage({ type, payload, timestamp: Date.now() });
        bc.close();
      }
    } catch {}
    // Also trigger local immediate refetch
    fetchState();
  }, [fetchState]);

  React.useEffect(() => {
    if (initialSync) {
      fetchState();
    }

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('securemax_realtime');
        setChannel(bc);
        bc.onmessage = (event) => {
          // Instantly refetch without full page reload
          fetchState();
        };
      } catch {}
    }

    // Lightweight 2-second background sync for multi-device / multi-browser
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchState();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (bc) {
        bc.close();
      }
    };
  }, [fetchState, initialSync]);

  return {
    data,
    refetch: fetchState,
    broadcastUpdate,
  };
}
