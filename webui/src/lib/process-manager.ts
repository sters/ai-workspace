import type { Operation, OperationEvent, OperationType } from "@/types/operation";
import { runClaude, type ClaudeProcess } from "./claude-sdk";

interface ManagedOperation {
  operation: Operation;
  claudeProcess: ClaudeProcess;
  events: OperationEvent[];
  listeners: Set<(event: OperationEvent) => void>;
}

// Persist state across Next.js dev mode HMR (module re-evaluation)
const globalStore = globalThis as unknown as {
  __aiWorkspaceOps?: Map<string, ManagedOperation>;
  __aiWorkspaceCounter?: number;
};

if (!globalStore.__aiWorkspaceOps) {
  globalStore.__aiWorkspaceOps = new Map();
}
if (globalStore.__aiWorkspaceCounter == null) {
  globalStore.__aiWorkspaceCounter = 0;
}

const operations = globalStore.__aiWorkspaceOps;

export function startOperation(
  type: OperationType,
  workspace: string,
  prompt: string
): Operation {
  const id = `op-${++globalStore.__aiWorkspaceCounter!}-${Date.now()}`;
  const operation: Operation = {
    id,
    type,
    workspace,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  const claudeProcess = runClaude(id, prompt);
  const managed: ManagedOperation = {
    operation,
    claudeProcess,
    events: [],
    listeners: new Set(),
  };

  claudeProcess.onEvent((event) => {
    managed.events.push(event);
    if (managed.events.length > 5000) {
      managed.events = managed.events.slice(-3000);
    }
    for (const listener of managed.listeners) {
      listener(event);
    }
    if (event.type === "complete") {
      const data = JSON.parse(event.data);
      operation.status = data.exitCode === 0 ? "completed" : "failed";
      operation.completedAt = new Date().toISOString();
    }
  });

  operations.set(id, managed);

  return operation;
}

export function getOperations(): Operation[] {
  return Array.from(operations.values()).map((m) => m.operation);
}

export function getOperation(id: string): Operation | undefined {
  return operations.get(id)?.operation;
}

export function getOperationEvents(id: string): OperationEvent[] {
  return operations.get(id)?.events ?? [];
}

export function subscribeToOperation(
  id: string,
  listener: (event: OperationEvent) => void
): () => void {
  const managed = operations.get(id);
  if (!managed) return () => {};
  managed.listeners.add(listener);
  return () => managed.listeners.delete(listener);
}

export function killOperation(id: string): boolean {
  const managed = operations.get(id);
  if (!managed || managed.operation.status !== "running") return false;
  managed.claudeProcess.kill();
  return true;
}

export function submitAnswer(
  id: string,
  toolUseId: string,
  answers: Record<string, string>
): boolean {
  const managed = operations.get(id);
  if (!managed || managed.operation.status !== "running") return false;
  return managed.claudeProcess.submitAnswer(toolUseId, answers);
}
