"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { OperationEvent } from "@/types/operation";

export function useSSE(operationId: string | null) {
  const [events, setEvents] = useState<OperationEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!operationId) return;

    setError(false);
    retryCountRef.current = 0;

    const connect = () => {
      const es = new EventSource(
        `/api/events?operationId=${encodeURIComponent(operationId)}`
      );
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setError(false);
        retryCountRef.current = 0;
      };

      es.onmessage = (e) => {
        try {
          const event: OperationEvent = JSON.parse(e.data);
          setEvents((prev) => [...prev, event]);
          // Only close on the pipeline-level complete (no childLabel).
          // Child process completes are tagged with childLabel and should not end the stream.
          if (event.type === "complete" && !event.childLabel) {
            es.close();
            setConnected(false);
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        setConnected(false);

        if (retryCountRef.current < 2) {
          retryCountRef.current++;
          setTimeout(connect, 1000);
        } else {
          setError(true);
        }
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
      setConnected(false);
    };
  }, [operationId]);

  const clear = useCallback(() => {
    setEvents([]);
    setError(false);
  }, []);

  return { events, connected, error, clear };
}
