import type {
  Operation,
  OperationEvent,
  OperationPhaseInfo,
  OperationType,
} from "@/types/operation";
import { runClaude, type ClaudeProcess, type RunClaudeOptions } from "./claude-sdk";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ManagedOperation {
  operation: Operation;
  claudeProcess: ClaudeProcess | null;
  childProcesses: Map<string, ClaudeProcess>;
  events: OperationEvent[];
  listeners: Set<(event: OperationEvent) => void>;
}

// ---------------------------------------------------------------------------
// Global store (survives HMR in dev mode)
// ---------------------------------------------------------------------------

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

function nextId(prefix: string): string {
  return `${prefix}-${++globalStore.__aiWorkspaceCounter!}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function emitEvent(managed: ManagedOperation, event: OperationEvent) {
  managed.events.push(event);
  if (managed.events.length > 5000) {
    managed.events = managed.events.slice(-3000);
  }
  for (const listener of managed.listeners) {
    listener(event);
  }
}

function emitStatus(
  managed: ManagedOperation,
  message: string,
  extra?: { childLabel?: string; phaseIndex?: number; phaseLabel?: string },
) {
  emitEvent(managed, {
    type: "status",
    operationId: managed.operation.id,
    data: message,
    timestamp: new Date().toISOString(),
    childLabel: extra?.childLabel,
    phaseIndex: extra?.phaseIndex,
    phaseLabel: extra?.phaseLabel,
  });
}

function markComplete(managed: ManagedOperation, success: boolean) {
  managed.operation.status = success ? "completed" : "failed";
  managed.operation.completedAt = new Date().toISOString();
  emitEvent(managed, {
    type: "complete",
    operationId: managed.operation.id,
    data: JSON.stringify({ exitCode: success ? 0 : 1 }),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Wire a child ClaudeProcess to the parent ManagedOperation.
 * Tags every event with childLabel (and optional phaseExtra) and updates child status on completion.
 */
function wireChild(
  managed: ManagedOperation,
  childId: string,
  childLabel: string,
  process: ClaudeProcess,
  phaseExtra?: { phaseIndex?: number; phaseLabel?: string },
): Promise<boolean> {
  managed.childProcesses.set(childId, process);
  emitStatus(managed, "Initializing...", { childLabel, ...phaseExtra });

  return new Promise<boolean>((resolve) => {
    process.onEvent((event) => {
      const tagged: OperationEvent = {
        ...event,
        operationId: managed.operation.id,
        childLabel,
        ...phaseExtra,
      };
      emitEvent(managed, tagged);

      if (event.type === "complete") {
        const data = JSON.parse(event.data);
        const success = data.exitCode === 0;
        const child = managed.operation.children?.find((c) => c.id === childId);
        if (child) child.status = success ? "completed" : "failed";
        managed.childProcesses.delete(childId);
        resolve(success);
      }
    });
  });
}

/** Helper to derive a label for a pipeline phase. */
function getPhaseLabel(phase: PipelinePhase, index: number): string {
  if (phase.kind === "single" || phase.kind === "function") return phase.label;
  return `Phase ${index + 1}: ${phase.children.map((c) => c.label).join(", ")}`;
}

/** Emit a __phaseUpdate status event so the client can track phase lifecycle. */
function emitPhaseUpdate(
  managed: ManagedOperation,
  phaseIndex: number,
  phaseLabel: string,
  phaseStatus: OperationPhaseInfo["status"],
) {
  const phases = managed.operation.phases;
  if (phases && phases[phaseIndex]) {
    phases[phaseIndex].status = phaseStatus;
  }
  emitStatus(managed, `__phaseUpdate:${JSON.stringify({ phaseIndex, phaseLabel, phaseStatus })}`, {
    phaseIndex,
    phaseLabel,
  });
}

// ---------------------------------------------------------------------------
// startOperationPipeline — sequential phases (the single entry point)
// ---------------------------------------------------------------------------

export interface GroupChild {
  label: string;
  prompt: string;
  options?: RunClaudeOptions;
}

export interface PipelinePhaseSingle {
  kind: "single";
  label: string;
  prompt: string;
  options?: RunClaudeOptions;
}

export interface PipelinePhaseGroup {
  kind: "group";
  children: GroupChild[];
}

export interface PhaseFunctionContext {
  operationId: string;
  emitStatus: (message: string) => void;
  /** Emit a result message that will be displayed outside the collapsible log. */
  emitResult: (message: string) => void;
  /** Run a single Claude child query and wait for completion. */
  runChild: (label: string, prompt: string, options?: RunClaudeOptions) => Promise<boolean>;
  /** Run multiple Claude child queries in parallel and wait for all to complete. */
  runChildGroup: (children: GroupChild[]) => Promise<boolean[]>;
}

export interface PipelinePhaseFunction {
  kind: "function";
  label: string;
  fn: (ctx: PhaseFunctionContext) => Promise<boolean>;
}

export type PipelinePhase =
  | PipelinePhaseSingle
  | PipelinePhaseGroup
  | PipelinePhaseFunction;

export interface PipelineOptions {
  onPhaseComplete?: (
    phaseIndex: number,
    phase: PipelinePhase,
    success: boolean,
  ) => "continue" | "skip" | "abort";
}

export function startOperationPipeline(
  type: OperationType,
  workspace: string,
  phases: PipelinePhase[],
  pipelineOptions?: PipelineOptions,
): Operation {
  const id = nextId("pipe");

  // Build phase info array
  const phaseInfos: OperationPhaseInfo[] = phases.map((phase, i) => ({
    index: i,
    label: getPhaseLabel(phase, i),
    status: "pending" as const,
  }));

  const operation: Operation = {
    id,
    type,
    workspace,
    status: "running",
    startedAt: new Date().toISOString(),
    children: [],
    phases: phaseInfos,
  };

  const managed: ManagedOperation = {
    operation,
    claudeProcess: null,
    childProcesses: new Map(),
    events: [],
    listeners: new Set(),
  };

  operations.set(id, managed);
  emitStatus(managed, `Starting pipeline with ${phases.length} phases`);

  (async () => {
    let pipelineSuccess = true;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const phaseNum = i + 1;
      const phaseLabel = phaseInfos[i].label;
      const phaseExtra = { phaseIndex: i, phaseLabel };
      let phaseSuccess: boolean;

      emitPhaseUpdate(managed, i, phaseLabel, "running");

      if (phase.kind === "function") {
        emitStatus(managed, `Phase ${phaseNum}/${phases.length}: ${phase.label}`, phaseExtra);
        const childId = `${id}-phase-${i}`;
        operation.children!.push({ id: childId, label: phase.label, status: "running" });

        let childCounter = 0;
        try {
          phaseSuccess = await phase.fn({
            operationId: id,
            emitStatus: (msg) => emitStatus(managed, msg, phaseExtra),
            emitResult: (msg) => {
              emitEvent(managed, {
                type: "output",
                operationId: managed.operation.id,
                data: JSON.stringify({ type: "result", subtype: "success", result: msg }),
                timestamp: new Date().toISOString(),
                ...phaseExtra,
              });
            },
            runChild: (label, prompt, opts) => {
              const cid = `${id}-phase-${i}-fn-${childCounter++}`;
              operation.children!.push({ id: cid, label, status: "running" });
              const proc = runClaude(cid, prompt, opts);
              return wireChild(managed, cid, label, proc, phaseExtra);
            },
            runChildGroup: (children) => {
              const promises = children.map((child) => {
                const cid = `${id}-phase-${i}-fn-${childCounter++}`;
                operation.children!.push({ id: cid, label: child.label, status: "running" });
                const proc = runClaude(cid, child.prompt, child.options);
                return wireChild(managed, cid, child.label, proc, phaseExtra);
              });
              return Promise.all(promises);
            },
          });
        } catch (err) {
          emitStatus(managed, `Phase ${phaseNum} error: ${err}`, phaseExtra);
          phaseSuccess = false;
        }

        const child = operation.children!.find((c) => c.id === childId);
        if (child) child.status = phaseSuccess ? "completed" : "failed";

      } else if (phase.kind === "single") {
        emitStatus(managed, `Phase ${phaseNum}/${phases.length}: ${phase.label}`, phaseExtra);
        const childId = `${id}-phase-${i}`;
        operation.children!.push({ id: childId, label: phase.label, status: "running" });
        const process = runClaude(childId, phase.prompt, phase.options);
        phaseSuccess = await wireChild(managed, childId, phase.label, process, phaseExtra);

      } else {
        // group
        const groupLabel = phase.children.map((c) => c.label).join(", ");
        emitStatus(managed, `Phase ${phaseNum}/${phases.length}: parallel [${groupLabel}]`, phaseExtra);

        const groupPromises = phase.children.map((child, j) => {
          const childId = `${id}-phase-${i}-child-${j}`;
          operation.children!.push({ id: childId, label: child.label, status: "running" });
          const process = runClaude(childId, child.prompt, child.options);
          return wireChild(managed, childId, child.label, process, phaseExtra);
        });

        const results = await Promise.all(groupPromises);
        phaseSuccess = results.every(Boolean);
        emitStatus(
          managed,
          `Phase ${phaseNum} group finished (${results.filter(Boolean).length}/${results.length} succeeded)`,
          phaseExtra,
        );
      }

      emitPhaseUpdate(managed, i, phaseLabel, phaseSuccess ? "completed" : "failed");

      if (pipelineOptions?.onPhaseComplete) {
        const action = pipelineOptions.onPhaseComplete(i, phase, phaseSuccess);
        if (action === "abort") {
          emitStatus(managed, `Pipeline aborted after phase ${phaseNum}`, phaseExtra);
          pipelineSuccess = false;
          break;
        }
        if (action === "skip") {
          emitPhaseUpdate(managed, i + 1, phaseInfos[i + 1]?.label ?? "", "skipped");
          emitStatus(managed, `Skipping phase ${phaseNum + 1}`, phaseExtra);
          i++;
          continue;
        }
      }

      if (!phaseSuccess) {
        emitStatus(managed, `Phase ${phaseNum} failed, aborting pipeline`, phaseExtra);
        pipelineSuccess = false;
        break;
      }
    }

    markComplete(managed, pipelineSuccess);
  })();

  return operation;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

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
  listener: (event: OperationEvent) => void,
): () => void {
  const managed = operations.get(id);
  if (!managed) return () => {};
  managed.listeners.add(listener);
  return () => managed.listeners.delete(listener);
}

export function killOperation(id: string): boolean {
  const managed = operations.get(id);
  if (!managed || managed.operation.status !== "running") return false;
  if (managed.claudeProcess) managed.claudeProcess.kill();
  for (const [, process] of managed.childProcesses) process.kill();
  return true;
}

export function submitAnswer(
  id: string,
  toolUseId: string,
  answers: Record<string, string>,
): boolean {
  const managed = operations.get(id);
  if (!managed || managed.operation.status !== "running") return false;
  if (managed.claudeProcess?.submitAnswer(toolUseId, answers)) return true;
  for (const [, process] of managed.childProcesses) {
    if (process.submitAnswer(toolUseId, answers)) return true;
  }
  return false;
}
