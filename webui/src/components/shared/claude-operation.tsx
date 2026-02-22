"use client";

import { useEffect, useRef, useMemo, useState, type ReactNode } from "react";
import { useOperation } from "@/hooks/use-operation";
import { OperationLog } from "./operation-log";
import { NextActionSuggestions } from "./next-action-suggestions";
import { StatusBadge } from "./status-badge";
import { MarkdownRenderer } from "./markdown-renderer";
import { parseStreamEvent, type LogEntry } from "@/lib/stream-parser";
import type { Operation, OperationType, OperationEvent } from "@/types/operation";

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
  /** The workspace name (may be updated dynamically during the operation). */
  workspace?: string;
  /** The operation status. */
  status?: string;
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
  vertical,
  workspace,
  onRunningChange,
  navigateNextActions,
}: {
  storageKey: string;
  children: (ctx: OperationContext) => ReactNode;
  vertical?: boolean;
  /** Workspace path — when provided, shows next action suggestions after completion. */
  workspace?: string;
  /** Called when the running state changes. Useful for coordinating multiple independent operations. */
  onRunningChange?: (running: boolean) => void;
  /** When true, next action buttons navigate via URL (?action=) instead of triggering inline. */
  navigateNextActions?: boolean;
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

  // Notify parent of running state changes
  const onRunningChangeRef = useRef(onRunningChange);
  onRunningChangeRef.current = onRunningChange;
  useEffect(() => {
    onRunningChangeRef.current?.(effectiveRunning);
  }, [effectiveRunning]);

  const showNextActions =
    workspace &&
    operation &&
    operation.status === "completed" &&
    !effectiveRunning;

  const statusBlock = operation && (
    <div className="flex items-center gap-2">
      <StatusBadge label={operation.status} variant={operation.status} />
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
  );

  const childContent = children({
    start: handleStart,
    isRunning: effectiveRunning,
    hasOperation: !!operation,
    workspace: operation?.workspace,
    status: operation?.status,
  });

  const nextActions = showNextActions && (
    <NextActionSuggestions
      operationType={operation.type}
      workspace={workspace}
      onStart={handleStart}
      isRunning={effectiveRunning}
      useNavigation={navigateNextActions}
    />
  );

  if (vertical) {
    return (
      <div className="space-y-3">
        {statusBlock && (
          <div className="flex justify-end">{statusBlock}</div>
        )}
        {childContent}
        {operation && (
          <CollapsibleOperationLog
            operation={operation}
            isRunning={isRunning}
            events={events}
          />
        )}
        {nextActions}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {childContent}
        {statusBlock && <div className="ml-auto">{statusBlock}</div>}
      </div>

      {operation && (
        <CollapsibleOperationLog
          operation={operation}
          isRunning={isRunning}
          events={events}
        />
      )}
      {nextActions}
    </div>
  );
}

/**
 * Wraps OperationLog with collapse/expand behavior.
 * - Expanded while running
 * - Collapsed by default after completion/failure
 * - Result entries (green output) are always visible outside the fold
 */
function CollapsibleOperationLog({
  operation,
  isRunning,
  events,
}: {
  operation: Operation;
  isRunning: boolean;
  events: OperationEvent[];
}) {
  const [expanded, setExpanded] = useState(true);
  const wasRunningRef = useRef(isRunning);

  // Auto-collapse when operation finishes
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) {
      setExpanded(false);
    }
    wasRunningRef.current = isRunning;
  }, [isRunning]);

  const isDone = !isRunning && (operation.status === "completed" || operation.status === "failed");

  // Extract result entries from events so they can be shown outside the fold
  const resultEntries = useMemo(() => {
    if (!isDone) return [];
    const results: LogEntry[] = [];
    for (const event of events) {
      if (event.type === "output") {
        const parsed = parseStreamEvent(event.data);
        for (const entry of parsed) {
          if (entry.kind === "result") {
            results.push(entry);
          }
        }
      }
    }
    return results;
  }, [isDone, events]);

  // Count log entries (excluding results) for the header
  const logEntryCount = useMemo(() => {
    if (!isDone) return 0;
    let count = 0;
    for (const event of events) {
      if (event.type === "output" || event.type === "error" || event.type === "status") {
        count++;
      }
    }
    return count;
  }, [isDone, events]);

  if (!isDone) {
    // While running, render directly without collapsible wrapper
    return (
      <OperationLog
        operationId={operation.id}
        events={events}
        isRunning={isRunning}
        phases={operation.phases}
      />
    );
  }

  const isSuccess = operation.status === "completed";

  return (
    <div className="rounded-md border">
      {/* Collapsible header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent/50"
      >
        <span className="text-muted-foreground">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className={`font-medium ${isSuccess ? "text-green-600" : "text-red-500"}`}>
          {isSuccess ? "\u2713" : "\u2717"}
        </span>
        <span className="font-medium text-foreground">
          {isSuccess ? "Operation completed" : "Operation failed"}
        </span>
        <span className="text-muted-foreground">
          ({logEntryCount} events)
        </span>
      </div>

      {/* Expanded: full log */}
      {expanded && (
        <div className="border-t p-2">
          <OperationLog
            operationId={operation.id}
            events={events}
            isRunning={isRunning}
            phases={operation.phases}
          />
        </div>
      )}

      {/* Result — show only the last phase's result */}
      {resultEntries.length > 0 && (() => {
        const last = resultEntries[resultEntries.length - 1];
        return (
          <div className="border-t p-2">
            <div className="rounded-md bg-green-50 p-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              <MarkdownRenderer content={last.kind === "result" ? last.content : ""} />
              {last.kind === "result" && (last.cost || last.duration) && (
                <div className="mt-1 text-xs opacity-70">
                  {[last.cost, last.duration].filter(Boolean).join(" | ")}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
