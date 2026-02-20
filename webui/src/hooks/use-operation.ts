"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Operation, OperationType } from "@/types/operation";
import { useSSE } from "./use-sse";

const STORAGE_PREFIX = "aiw-op:";

/**
 * @param storageKey  Optional key to persist the active operation in localStorage.
 *                    When provided, the operation ID is saved so that navigating
 *                    away and returning automatically reconnects to the SSE stream.
 */
export function useOperation(storageKey?: string) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const restoredRef = useRef(false);

  // ---------- Restore from localStorage on mount ----------
  useEffect(() => {
    if (!storageKey || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
      if (!raw) return;
      const stored: Operation = JSON.parse(raw);
      // Only restore running operations (completed ones can be shown too)
      if (stored?.id) {
        setOperation(stored);
      }
    } catch {
      // corrupted data — ignore
    }
  }, [storageKey]);

  // ---------- SSE ----------
  const { events, connected, error: sseError, clear } = useSSE(
    operation?.id ?? null
  );

  // ---------- Persist to localStorage ----------
  useEffect(() => {
    if (!storageKey) return;
    if (operation) {
      localStorage.setItem(
        `${STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(operation)
      );
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    }
  }, [storageKey, operation]);

  // ---------- SSE error → clear stale stored operation ----------
  useEffect(() => {
    if (sseError && storageKey && operation) {
      // Server likely restarted and lost the operation
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
      setOperation(null);
    }
  }, [sseError, storageKey, operation]);

  // ---------- Complete event → update status ----------
  useEffect(() => {
    const last = events[events.length - 1];
    if (last?.type === "complete" && operation?.status === "running") {
      try {
        const d = JSON.parse(last.data);
        setOperation((prev) =>
          prev
            ? {
                ...prev,
                status: d.exitCode === 0 ? "completed" : "failed",
                completedAt: new Date().toISOString(),
              }
            : null
        );
      } catch {
        // ignore
      }
    }
  }, [events, operation?.status]);

  // ---------- Actions ----------
  const start = useCallback(
    async (type: OperationType, body: Record<string, string>) => {
      clear();
      const res = await fetch(`/api/operations/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const op: Operation = await res.json();
      setOperation(op);
      return op;
    },
    [clear]
  );

  const cancel = useCallback(async () => {
    if (!operation) return;
    try {
      await fetch("/api/operations/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: operation.id }),
      });
    } catch {
      // ignore
    }
  }, [operation]);

  const reset = useCallback(() => {
    setOperation(null);
    clear();
    if (storageKey) {
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    }
  }, [clear, storageKey]);

  const isRunning =
    operation?.status === "running" && (connected || !sseError);

  return { operation, events, connected, isRunning, start, cancel, reset };
}
