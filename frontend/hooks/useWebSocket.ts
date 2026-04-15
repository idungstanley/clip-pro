'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { wsUrl } from '@/lib/api';

export interface WSEvent {
  stage: string;
  pct: number;
  message: string;
  data?: any;
}

export function useWebSocket(jobId: string | null) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    setEvents([]);
    setLastEvent(null);
    setDone(false);
    setError(null);

    // Guard against React StrictMode double-invoke: if this effect cleanup
    // runs before the WS opens, we mark it stale and ignore all callbacks.
    let stale = false;
    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stale) return;

      ws = new WebSocket(wsUrl(`/ws/job/${jobId}`));

      ws.onopen = () => {
        if (stale) { ws?.close(); return; }
      };

      ws.onmessage = (e) => {
        if (stale) return;
        try {
          const event: WSEvent = JSON.parse(e.data);
          setLastEvent(event);
          setEvents((prev) => [...prev, event]);
          if (event.stage === 'done') setDone(true);
          if (event.stage === 'error') setError(event.message);
        } catch {}
      };

      ws.onerror = () => {
        if (stale) return;
        // Retry once after 1s — backend may still be starting
        retryTimeout = setTimeout(() => {
          if (!stale) connect();
        }, 1000);
      };

      ws.onclose = (e) => {
        if (stale) return;
        // Abnormal close (not triggered by us) — backend may have crashed
        if (e.code !== 1000 && e.code !== 1001) {
          setError('Lost connection to backend');
        }
      };
    };

    // Small delay so React StrictMode's first mount/unmount cycle clears
    // before we open a real connection.
    const initTimeout = setTimeout(connect, 100);

    return () => {
      stale = true;
      clearTimeout(initTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, 'unmount');
      }
    };
  }, [jobId]);

  return { events, lastEvent, done, error };
}
