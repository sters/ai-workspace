import { execSync } from "node:child_process";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { AI_WORKSPACE_ROOT } from "./config";
import type { OperationEvent } from "@/types/operation";

// Resolve the actual path to the claude CLI binary
let cliPath: string;
try {
  const bin = execSync("which claude", { encoding: "utf-8" }).trim();
  // Follow symlinks — try realpath first (works on macOS), fall back to readlink -f
  try {
    cliPath = execSync(`realpath "${bin}"`, { encoding: "utf-8" }).trim();
  } catch {
    try {
      cliPath = execSync(`readlink -f "${bin}"`, { encoding: "utf-8" }).trim();
    } catch {
      cliPath = bin;
    }
  }
} catch {
  cliPath = "claude";
}

export interface ClaudeProcess {
  id: string;
  onEvent: (handler: (event: OperationEvent) => void) => void;
  kill: () => void;
  submitAnswer: (toolUseId: string, answers: Record<string, string>) => boolean;
}

export interface RunClaudeOptions {
  /** Working directory override. Defaults to AI_WORKSPACE_ROOT. */
  cwd?: string;
}

function log(operationId: string, ...args: unknown[]) {
  console.log(`[claude-sdk][${operationId}]`, ...args);
}

export function runClaude(
  operationId: string,
  prompt: string,
  options?: RunClaudeOptions
): ClaudeProcess {
  const handlers: ((event: OperationEvent) => void)[] = [];
  const earlyEvents: OperationEvent[] = [];
  const abortController = new AbortController();

  // Pending AskUserQuestion answers: toolUseId -> resolve function
  const pendingAnswers = new Map<
    string,
    (answers: Record<string, string>) => void
  >();

  const emit = (event: OperationEvent) => {
    if (handlers.length === 0) {
      earlyEvents.push(event);
    } else {
      for (const h of handlers) h(event);
    }
  };

  const cwd = options?.cwd ?? AI_WORKSPACE_ROOT;

  log(operationId, "starting SDK query");
  log(operationId, "cwd:", cwd);
  log(operationId, "prompt:", prompt.slice(0, 200) + (prompt.length > 200 ? "..." : ""));
  log(operationId, "cliPath:", cliPath);

  // Run the SDK query in the background (non-blocking)
  (async () => {
    try {
      const conversation = query({
        prompt,
        options: {
          abortController,
          cwd,
          pathToClaudeCodeExecutable: cliPath,
          // Only use user settings — no .claude/ project settings needed
          settingSources: ["user"],
          // Use canUseTool to auto-approve all tools and handle AskUserQuestion interactively
          canUseTool: async (toolName, input, options) => {
            if (toolName === "AskUserQuestion") {
              log(operationId, "AskUserQuestion detected, waiting for user answer");

              const answers = await new Promise<Record<string, string>>(
                (resolve) => {
                  pendingAnswers.set(options.toolUseID, resolve);

                  // Clean up if aborted
                  options.signal.addEventListener("abort", () => {
                    pendingAnswers.delete(options.toolUseID);
                    // Resolve with empty answers to unblock the callback
                    resolve({});
                  });
                }
              );

              log(operationId, "AskUserQuestion answered:", answers);
              return {
                behavior: "allow" as const,
                updatedInput: {
                  questions: (input as Record<string, unknown>).questions,
                  answers,
                },
              };
            }

            // Auto-approve all other tools
            return { behavior: "allow" as const, updatedInput: input };
          },
        },
      });

      for await (const msg of conversation) {
        emit({
          type: "output",
          operationId,
          data: JSON.stringify(msg),
          timestamp: new Date().toISOString(),
        });
      }

      log(operationId, "query completed normally");
      emit({
        type: "complete",
        operationId,
        data: JSON.stringify({ exitCode: 0 }),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // Clean up pending answers
      pendingAnswers.clear();

      if (abortController.signal.aborted) {
        log(operationId, "query aborted");
        emit({
          type: "complete",
          operationId,
          data: JSON.stringify({ exitCode: 1 }),
          timestamp: new Date().toISOString(),
        });
      } else {
        log(operationId, "query error:", err);
        emit({
          type: "error",
          operationId,
          data: String(err),
          timestamp: new Date().toISOString(),
        });
        emit({
          type: "complete",
          operationId,
          data: JSON.stringify({ exitCode: 1 }),
          timestamp: new Date().toISOString(),
        });
      }
    }
  })();

  return {
    id: operationId,
    onEvent: (handler) => {
      handlers.push(handler);
      // Replay events that arrived before handler was registered
      for (const event of earlyEvents) {
        handler(event);
      }
      earlyEvents.length = 0;
    },
    kill: () => abortController.abort(),
    submitAnswer: (toolUseId, answers) => {
      const resolve = pendingAnswers.get(toolUseId);
      if (!resolve) return false;
      pendingAnswers.delete(toolUseId);
      resolve(answers);
      return true;
    },
  };
}
