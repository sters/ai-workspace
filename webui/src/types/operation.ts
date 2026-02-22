export type OperationType =
  | "init"
  | "execute"
  | "review"
  | "create-pr"
  | "update-todo"
  | "delete"
  | "workspace-prune";

export interface OperationChild {
  id: string;
  label: string;
  status: "running" | "completed" | "failed";
}

export interface OperationPhaseInfo {
  index: number;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
}

export interface Operation {
  id: string;
  type: OperationType;
  workspace: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  children?: OperationChild[];
  phases?: OperationPhaseInfo[];
}

export interface OperationEvent {
  type: "output" | "error" | "complete" | "status";
  operationId: string;
  data: string;
  timestamp: string;
  /** Which child operation this event belongs to (for operation groups). */
  childLabel?: string;
  /** Pipeline phase index (0-based) this event belongs to. */
  phaseIndex?: number;
  /** Pipeline phase label this event belongs to. */
  phaseLabel?: string;
}
