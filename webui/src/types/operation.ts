export type OperationType =
  | "init"
  | "execute"
  | "review"
  | "create-pr"
  | "update-todo"
  | "delete"
  | "permissions-suggest"
  | "workspace-prune";

export interface Operation {
  id: string;
  type: OperationType;
  workspace: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
}

export interface OperationEvent {
  type: "output" | "error" | "complete" | "status";
  operationId: string;
  data: string;
  timestamp: string;
}
