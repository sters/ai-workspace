"use client";

import { useState, type ReactNode } from "react";
import { useOperation } from "@/hooks/use-operation";
import { OperationLog } from "./operation-log";
import { StatusBadge } from "./status-badge";
import type { OperationType } from "@/types/operation";

export interface OperationContext {
  /** Start a new operation. Handles loading state internally. */
  start: (
    type: OperationType,
    body: Record<string, string>
  ) => Promise<void>;
  /** True while an operation is running (or starting). */
  isRunning: boolean;
  /** True when there is an active or completed operation. */
  hasOperation: boolean;
}

/**
 * Shared component for running Claude operations.
 *
 * Handles:
 * - Operation state lifecycle (via useOperation + localStorage persistence)
 * - Status badge, Cancel button (running), Clear button (done)
 * - OperationLog rendering
 *
 * The caller provides trigger UI (buttons, forms) via `children` render prop.
 */
export function ClaudeOperation({
  storageKey,
  children,
}: {
  storageKey: string;
  children: (ctx: OperationContext) => ReactNode;
}) {
  const { operation, events, isRunning, start, cancel, reset } =
    useOperation(storageKey);
  const [loading, setLoading] = useState(false);

  const handleStart = async (
    type: OperationType,
    body: Record<string, string>
  ) => {
    setLoading(true);
    try {
      await start(type, body);
    } catch (err) {
      console.error("Failed to start operation:", err);
    } finally {
      setLoading(false);
    }
  };

  const effectiveRunning = isRunning || loading;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {children({
          start: handleStart,
          isRunning: effectiveRunning,
          hasOperation: !!operation,
        })}

        {operation && (
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge
              label={operation.status}
              variant={operation.status}
            />
            {isRunning ? (
              <button
                onClick={cancel}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={reset}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {operation && (
        <OperationLog
          operationId={operation.id}
          events={events}
          isRunning={isRunning}
        />
      )}
    </div>
  );
}
