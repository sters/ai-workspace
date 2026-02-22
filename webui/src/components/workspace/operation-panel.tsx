"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClaudeOperation, type OperationContext } from "../shared/claude-operation";
import type { OperationType } from "@/types/operation";

export function OperationPanel({
  workspacePath,
  autoAction,
  onAutoActionConsumed,
}: {
  workspacePath: string;
  /** When set, auto-trigger this operation on mount (once). */
  autoAction?: OperationType;
  /** Called after auto-action has been triggered, so the parent can clear the param. */
  onAutoActionConsumed?: () => void;
}) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const autoActionFiredRef = useRef(false);

  const openDeleteDialog = () => {
    setShowDeleteConfirm(true);
    dialogRef.current?.showModal();
  };

  const closeDeleteDialog = () => {
    dialogRef.current?.close();
    setShowDeleteConfirm(false);
  };

  return (
    <ClaudeOperation storageKey={`workspace:${workspacePath}`} workspace={workspacePath}>
      {({ start, isRunning, hasOperation }) => (
        <AutoActionWrapper
          autoAction={autoAction}
          firedRef={autoActionFiredRef}
          start={start}
          isRunning={isRunning}
          hasOperation={hasOperation}
          workspacePath={workspacePath}
          onConsumed={onAutoActionConsumed}
        >
          <button
            onClick={() => start("execute", { workspace: workspacePath })}
            disabled={isRunning}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Execute
          </button>
          <button
            onClick={() => start("review", { workspace: workspacePath })}
            disabled={isRunning}
            className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Review
          </button>
          <button
            onClick={() => start("create-pr", { workspace: workspacePath })}
            disabled={isRunning}
            className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Create PR
          </button>
          <button
            onClick={openDeleteDialog}
            disabled={isRunning}
            className="rounded-md border border-red-300 bg-transparent px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete workspace
          </button>

          {showDeleteConfirm && (
            <dialog
              ref={dialogRef}
              onClose={closeDeleteDialog}
              className="fixed inset-0 m-auto w-full max-w-md rounded-lg border bg-background p-0 shadow-lg backdrop:bg-black/50"
            >
              <div className="p-6">
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  Delete workspace
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Are you sure you want to delete this workspace? This action
                  cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeDeleteDialog}
                    className="rounded-md border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      closeDeleteDialog();
                      await start("delete", { workspace: workspacePath });
                      router.push("/");
                    }}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </dialog>
          )}
        </AutoActionWrapper>
      )}
    </ClaudeOperation>
  );
}

/**
 * Helper component that auto-triggers an action via useEffect.
 * Must be a separate component so the effect can access the `start` function
 * from the ClaudeOperation render prop.
 */
function AutoActionWrapper({
  autoAction,
  firedRef,
  start,
  isRunning,
  hasOperation,
  workspacePath,
  onConsumed,
  children,
}: {
  autoAction?: OperationType;
  firedRef: React.MutableRefObject<boolean>;
  start: OperationContext["start"];
  isRunning: boolean;
  hasOperation: boolean;
  workspacePath: string;
  onConsumed?: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!autoAction || firedRef.current || isRunning || hasOperation) return;
    firedRef.current = true;
    start(autoAction, { workspace: workspacePath });
    onConsumed?.();
  }, [autoAction, firedRef, start, isRunning, hasOperation, workspacePath, onConsumed]);

  return <>{children}</>;
}
