"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import type { OperationEvent } from "@/types/operation";
import {
  parseStreamEvent,
  type LogEntry,
  type AskQuestion,
} from "@/lib/stream-parser";
import { MarkdownRenderer } from "./markdown-renderer";

interface OperationLogProps {
  operationId: string;
  events: OperationEvent[];
  isRunning: boolean;
}

/**
 * A display node in the log tree.
 * Top-level entries render directly; sub-agent groups render as collapsible sections.
 */
type DisplayNode =
  | { type: "entry"; entry: LogEntry }
  | {
      type: "subagent";
      toolUseId: string;
      description: string;
      status: "running" | "completed" | "failed" | "stopped";
      /** Summary text from task_notification. */
      summary?: string;
      /** Formatted usage (e.g., "12.3s, 5 tools"). */
      usage?: string;
      /** Sub-agent messages (if any come through the SDK stream). */
      entries: LogEntry[];
    };

export function OperationLog({
  operationId,
  events,
  isRunning,
}: OperationLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const result: LogEntry[] = [];
    for (const event of events) {
      if (event.type === "output") {
        result.push(...parseStreamEvent(event.data));
      } else if (event.type === "error") {
        result.push({ kind: "error", content: event.data });
      } else if (event.type === "complete") {
        try {
          const d = JSON.parse(event.data);
          result.push({ kind: "complete", exitCode: d.exitCode ?? -1 });
        } catch {
          result.push({ kind: "complete", exitCode: -1 });
        }
      }
    }
    return result;
  }, [events]);

  // Build display nodes: group sub-agent entries under their parent Task tool_use_id.
  const nodes = useMemo(() => buildDisplayNodes(entries), [entries]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries.length]);

  if (events.length === 0) {
    return null;
  }

  // Find the latest unanswered ask entry
  const pendingAsk = isRunning ? findPendingAsk(entries) : null;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="max-h-[500px] overflow-auto rounded-lg border bg-card p-3 text-sm"
      >
        <div className="space-y-1.5">
          {nodes.map((node, i) =>
            node.type === "entry" ? (
              <EntryRow key={i} entry={node.entry} />
            ) : (
              <SubAgentSection key={node.toolUseId} group={node} />
            )
          )}
        </div>
      </div>

      {pendingAsk && (
        <AskInput
          operationId={operationId}
          toolUseId={pendingAsk.toolId}
          questions={pendingAsk.questions}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build display tree
// ---------------------------------------------------------------------------

function buildDisplayNodes(entries: LogEntry[]): DisplayNode[] {
  const nodes: DisplayNode[] = [];

  // Collect task_started descriptions and task_notification data by toolUseId
  const taskInfo = new Map<
    string,
    {
      description: string;
      status: "running" | "completed" | "failed" | "stopped";
      summary?: string;
      usage?: string;
    }
  >();

  for (const e of entries) {
    if (e.kind === "system" && e.taskToolUseId) {
      const existing = taskInfo.get(e.taskToolUseId);
      if (e.taskStatus === "running") {
        taskInfo.set(e.taskToolUseId, {
          description: e.content.replace(/^Task started:\s*/, ""),
          status: "running",
        });
      } else if (e.taskStatus) {
        taskInfo.set(e.taskToolUseId, {
          description: existing?.description ?? e.content,
          status: e.taskStatus as "completed" | "failed" | "stopped",
          summary: e.taskSummary,
          usage: e.taskUsage,
        });
      }
    }
  }

  // Find all Task tool_call ids (these are parent tool_use_ids for sub-agents)
  const taskToolUseIds = new Set<string>();
  for (const e of entries) {
    if (e.kind === "tool_call" && e.toolName === "Task") {
      taskToolUseIds.add(e.toolId);
    }
  }
  // Also add any parent IDs seen on entries
  for (const e of entries) {
    if (e.parentToolUseId) {
      taskToolUseIds.add(e.parentToolUseId);
    }
  }
  // Also add task_started toolUseIds
  for (const id of taskInfo.keys()) {
    taskToolUseIds.add(id);
  }

  // Bucket sub-agent entries
  const subagentEntries = new Map<string, LogEntry[]>();
  for (const id of taskToolUseIds) {
    subagentEntries.set(id, []);
  }

  // Track which toolUseIds have their sub-agent section already emitted
  const emitted = new Set<string>();

  for (const e of entries) {
    const pid = e.parentToolUseId;

    // Skip task_started/task_notification system entries — they're shown in the section header
    if (e.kind === "system" && e.taskToolUseId && taskToolUseIds.has(e.taskToolUseId)) {
      // If this is a task_notification (not running), ensure we still emit the group
      if (!emitted.has(e.taskToolUseId)) {
        // Don't emit here — it'll be emitted when we encounter the Task tool_call
      }
      continue;
    }

    // Sub-agent entry
    if (pid && subagentEntries.has(pid)) {
      subagentEntries.get(pid)!.push(e);
      continue;
    }

    // Top-level Task tool_call → emit the sub-agent section
    if (e.kind === "tool_call" && e.toolName === "Task" && !emitted.has(e.toolId)) {
      emitted.add(e.toolId);
      const info = taskInfo.get(e.toolId);
      nodes.push({
        type: "subagent",
        toolUseId: e.toolId,
        description: info?.description ?? e.summary,
        status: info?.status ?? "running",
        summary: info?.summary,
        usage: info?.usage,
        entries: subagentEntries.get(e.toolId) ?? [],
      });
      continue;
    }

    // Top-level tool_result for a Task — skip (already in the section header status)
    if (e.kind === "tool_result" && taskToolUseIds.has(e.toolId)) {
      continue;
    }

    // tool_progress for a task — skip (handled in section)
    if (e.kind === "tool_progress" && e.taskId) {
      continue;
    }

    // Regular top-level entry
    nodes.push({ type: "entry", entry: e });
  }

  // Emit any sub-agent groups that weren't tied to a Task tool_call
  // (e.g., task_started arrived but no Task tool_call was seen yet)
  for (const id of taskToolUseIds) {
    if (!emitted.has(id)) {
      const info = taskInfo.get(id);
      const childEntries = subagentEntries.get(id) ?? [];
      // Only emit if we have task info or child entries
      if (info || childEntries.length > 0) {
        emitted.add(id);
        nodes.push({
          type: "subagent",
          toolUseId: id,
          description: info?.description ?? `Sub-agent ${id.slice(0, 8)}`,
          status: info?.status ?? "running",
          summary: info?.summary,
          usage: info?.usage,
          entries: childEntries,
        });
      }
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Sub-agent section
// ---------------------------------------------------------------------------

function SubAgentSection({
  group,
}: {
  group: Extract<DisplayNode, { type: "subagent" }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasEntries = group.entries.length > 0;

  const statusColor = {
    running: "text-blue-500",
    completed: "text-green-600",
    failed: "text-red-500",
    stopped: "text-yellow-600",
  }[group.status];

  const statusIcon = {
    running: "\u25CF",
    completed: "\u2713",
    failed: "\u2717",
    stopped: "\u25A0",
  }[group.status];

  return (
    <div className="rounded-md border border-indigo-200 dark:border-indigo-800">
      {/* Header */}
      <div
        role={hasEntries ? "button" : undefined}
        tabIndex={hasEntries ? 0 : undefined}
        onClick={hasEntries ? () => setExpanded(!expanded) : undefined}
        className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs${
          hasEntries ? " cursor-pointer hover:bg-accent/50" : ""
        }`}
      >
        {hasEntries ? (
          <span className="text-muted-foreground">
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        ) : (
          <span className="w-3" />
        )}
        <span className={`${statusColor} font-medium`}>{statusIcon}</span>
        <span className="font-medium text-foreground">{group.description}</span>
        {group.usage && (
          <span className="text-muted-foreground">{group.usage}</span>
        )}
        {hasEntries && (
          <span className="text-muted-foreground">
            ({group.entries.length} events)
          </span>
        )}
      </div>

      {/* Summary from task_notification */}
      {group.summary && (
        <div className="border-t border-indigo-200 px-2.5 py-1.5 text-xs text-muted-foreground dark:border-indigo-800">
          {group.summary}
        </div>
      )}

      {/* Expanded child entries (when SDK streams sub-agent messages) */}
      {expanded && hasEntries && (
        <div className="border-t border-indigo-200 bg-indigo-50/30 p-2 dark:border-indigo-800 dark:bg-indigo-950/20">
          <div className="space-y-1.5">
            {group.entries.map((entry, i) => (
              <EntryRow key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry renderers
// ---------------------------------------------------------------------------

function EntryRow({ entry }: { entry: LogEntry }) {
  switch (entry.kind) {
    case "text":
      return (
        <div className="rounded-md border-l-2 border-blue-400 bg-blue-50/50 py-1 pl-3 pr-2 dark:bg-blue-950/30">
          <MarkdownRenderer content={entry.content} />
        </div>
      );
    case "thinking":
      return <ThinkingRow content={entry.content} />;
    case "tool_call":
      return (
        <div className="flex items-start gap-2 font-mono text-xs text-muted-foreground">
          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-semibold">
            {entry.toolName}
          </span>
          <span className="truncate">{entry.summary}</span>
        </div>
      );
    case "tool_result":
      if (!entry.content) return null;
      return (
        <CollapsibleRow
          content={entry.content}
          className={entry.isError ? "text-red-400" : "text-muted-foreground"}
        />
      );
    case "ask":
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          {entry.questions.map((q, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="font-medium">{q.question}</p>
              {q.options.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {q.options.map((o, j) => (
                    <li key={j}>
                      <span className="font-medium">{o.label}</span>
                      {o.description && <span> &mdash; {o.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    case "result":
      return (
        <div className="whitespace-pre-wrap rounded-md bg-green-50 p-2 text-green-800 dark:bg-green-950 dark:text-green-200">
          {entry.content}
          {(entry.cost || entry.duration) && (
            <div className="mt-1 text-xs opacity-70">
              {[entry.cost, entry.duration].filter(Boolean).join(" | ")}
            </div>
          )}
        </div>
      );
    case "system":
      return (
        <div className="text-xs text-muted-foreground italic">
          {entry.content}
        </div>
      );
    case "error":
      return (
        <div className="whitespace-pre-wrap text-red-500">
          {entry.content}
        </div>
      );
    case "complete": {
      const ok = entry.exitCode === 0;
      return (
        <div
          className={`text-xs font-medium ${ok ? "text-green-600" : "text-red-500"}`}
        >
          Process exited ({entry.exitCode})
        </div>
      );
    }
    case "tool_progress":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono font-semibold">
            {entry.toolName}
          </span>
          <span>{entry.elapsed.toFixed(0)}s elapsed</span>
        </div>
      );
    case "raw":
      return (
        <div className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
          {entry.content}
        </div>
      );
  }
}

function ThinkingRow({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = content.split("\n").slice(0, 2).join("\n");
  const isLong = content.length > 200;

  return (
    <div className="rounded-md border border-purple-200 bg-purple-50 p-2 text-xs text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 font-medium"
      >
        <span>{expanded ? "\u25BC" : "\u25B6"}</span>
        <span>Thinking</span>
      </button>
      {expanded && (
        <div className="mt-1 whitespace-pre-wrap">{content}</div>
      )}
      {!expanded && isLong && (
        <div className="mt-1 truncate opacity-60">{preview}</div>
      )}
    </div>
  );
}

function CollapsibleRow({
  content,
  className,
}: {
  content: string;
  className: string;
}) {
  const lines = content.split("\n");
  const [expanded, setExpanded] = useState(false);
  const preview = lines[0]?.slice(0, 80) || "";

  return (
    <div className={`font-mono text-xs ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 font-medium"
      >
        <span>{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="truncate opacity-70">
          {preview}
          {(lines[0]?.length ?? 0) > 80 ? "…" : ""}
        </span>
        <span className="shrink-0 text-muted-foreground">
          ({lines.length} lines)
        </span>
      </button>
      {expanded && (
        <div className="mt-1 max-h-96 overflow-auto whitespace-pre rounded border bg-muted/30 p-2">
          {content}
        </div>
      )}
    </div>
  );
}

function AskInput({
  operationId,
  toolUseId,
  questions,
}: {
  operationId: string;
  toolUseId: string;
  questions: AskQuestion[];
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (answers: Record<string, string>) => {
      setSubmitting(true);
      try {
        await fetch("/api/operations/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId, toolUseId, answers }),
        });
      } catch {
        // ignore
      } finally {
        setSubmitting(false);
      }
    },
    [operationId, toolUseId]
  );

  const handleOptionClick = useCallback(
    (questionText: string, label: string) => {
      submit({ [questionText]: label });
    },
    [submit]
  );

  const handleFreeText = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim()) return;
      // Map free text to the first question
      const firstQuestion = questions[0]?.question ?? "";
      submit({ [firstQuestion]: value.trim() });
      setValue("");
    },
    [value, questions, submit]
  );

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="mb-2 text-sm font-medium">Input required</p>

      {questions.map((q, qi) => (
        <div key={qi} className="mb-3 last:mb-2">
          <p className="mb-1.5 text-sm">{q.question}</p>
          {q.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((o, oi) => (
                <button
                  key={oi}
                  onClick={() => handleOptionClick(q.question, o.label)}
                  disabled={submitting}
                  className="rounded-md border bg-background px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
                  title={o.description}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <form onSubmit={handleFreeText} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a response..."
          disabled={submitting}
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Find the latest "ask" entry that doesn't have a subsequent tool_result for the same toolId.
function findPendingAsk(
  entries: LogEntry[]
): { toolId: string; questions: AskQuestion[] } | null {
  const answeredIds = new Set<string>();
  for (const e of entries) {
    if (e.kind === "tool_result") {
      answeredIds.add(e.toolId);
    }
  }

  // Walk backward to find the latest unanswered ask
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "ask" && !answeredIds.has(e.toolId)) {
      return { toolId: e.toolId, questions: e.questions };
    }
  }

  return null;
}
