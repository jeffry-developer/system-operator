import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const HEALTH_ENDPOINT = `${API_URL.replace('/api/v1', '')}/health`;
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const WAKE_UP_TIMEOUT_MS = 90 * 1000;    // 90 segundos máximo esperando
const INITIAL_PROBE_MS = 4000;            // Esperar 4s antes de mostrar pantalla de carga

export type ServerStatus = 'checking' | 'waking' | 'online' | 'error';

export interface ServerStatusResult {
  status: ServerStatus;
  elapsedSeconds: number;
  retry: () => void;
}

export function useServerStatus(enabled: boolean = true): ServerStatusResult {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startKeepAlive = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(async () => {
      try {
        await fetch(HEALTH_ENDPOINT, { method: 'GET', signal: AbortSignal.timeout(5000) });
      } catch {
        // silently ignore keep-alive failures
      }
    }, PING_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let probeTimer: ReturnType<typeof setTimeout>;
    let attemptCount = 0;

    const probe = async (): Promise<boolean> => {
      try {
        const res = await fetch(HEALTH_ENDPOINT, {
          method: 'GET',
          signal: AbortSignal.timeout(8000),
        });
        return res.ok;
      } catch {
        return false;
      }
    };

    const pollUntilOnline = async () => {
      const startTime = Date.now();

      timerRef.current = setInterval(() => {
        if (!cancelled) {
          setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);

      while (!cancelled) {
        attemptCount++;
        const ok = await probe();

        if (cancelled) break;

        if (ok) {
          setStatus('online');
          startKeepAlive();
          clearTimers();
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > WAKE_UP_TIMEOUT_MS) {
          setStatus('error');
          clearTimers();
          return;
        }

        const waitMs = Math.min(3000 + attemptCount * 500, 8000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    };

    const init = async () => {
      setStatus('checking');
      setElapsedSeconds(0);

      const firstProbeOk = await probe();
      if (cancelled) return;

      if (firstProbeOk) {
        setStatus('online');
        startKeepAlive();
        return;
      }

      probeTimer = setTimeout(async () => {
        if (cancelled) return;
        const secondProbeOk = await probe();
        if (cancelled) return;

        if (secondProbeOk) {
          setStatus('online');
          startKeepAlive();
        } else {
          setStatus('waking');
          pollUntilOnline();
        }
      }, INITIAL_PROBE_MS);
    };

    init();

    return () => {
      cancelled = true;
      clearTimers();
      clearTimeout(probeTimer);
    };
  }, [enabled, retryTrigger, startKeepAlive]);

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  const retry = useCallback(() => {
    setRetryTrigger((n) => n + 1);
  }, []);

  return { status, elapsedSeconds, retry };
}
