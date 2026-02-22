// Parse SDK messages from @anthropic-ai/claude-agent-sdk into displayable log entries.

export type LogEntryBase = {
  /** Non-null when the entry originates from a sub-agent (Task tool). */
  parentToolUseId?: string | null;
  /** Label for grouping entries in operation groups/pipelines. */
  childLabel?: string;
  /** Phase index for pipeline operations. */
  phaseIndex?: number;
  /** Phase label for pipeline operations. */
  phaseLabel?: string;
};

export type LogEntry = LogEntryBase &
  (
    | { kind: "text"; content: string }
    | { kind: "thinking"; content: string }
    | { kind: "tool_call"; toolName: string; toolId: string; summary: string }
    | { kind: "tool_result"; toolId: string; content: string; isError: boolean }
    | { kind: "ask"; toolId: string; questions: AskQuestion[] }
    | { kind: "result"; content: string; cost?: string; duration?: string }
    | {
        kind: "system";
        content: string;
        /** Set on task_started / task_notification entries. */
        taskToolUseId?: string;
        taskStatus?: string;
        /** Raw summary from task_notification. */
        taskSummary?: string;
        /** Formatted usage string from task_notification (e.g., "12.3s, 5 tools"). */
        taskUsage?: string;
        /** Task ID from the SDK. */
        taskId?: string;
        /** Output file path for background tasks. */
        taskOutputFile?: string;
      }
    | { kind: "error"; content: string }
    | { kind: "complete"; exitCode: number }
    | { kind: "raw"; content: string }
    | {
        kind: "tool_progress";
        toolUseId: string;
        toolName: string;
        elapsed: number;
        taskId?: string;
      }
  );

export interface AskQuestion {
  question: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeToolInput(name: string, input: any): string {
  switch (name) {
    case "Bash":
      return `$ ${input?.command ?? ""}`;
    case "Read":
    case "Write":
    case "Edit":
      return input?.file_path ?? "";
    case "Glob":
      return input?.pattern ?? "";
    case "Grep":
      return `/${input?.pattern ?? ""}/`;
    case "Task":
      return input?.description ?? input?.prompt?.slice(0, 80) ?? "";
    case "WebFetch":
      return input?.url ?? "";
    case "WebSearch":
      return input?.query ?? "";
    default:
      return "";
  }
}

export function parseStreamEvent(raw: string): LogEntry[] {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ kind: "raw", content: raw }];
  }

  const entries: LogEntry[] = [];

  // SDK auth_status message: { type: "auth_status", error?: string }
  if (parsed.type === "auth_status") {
    if (parsed.error) {
      entries.push({
        kind: "error",
        content: `Authentication failed: ${parsed.error}\nRun "claude login" in your terminal to re-authenticate.`,
      });
    }
    return entries;
  }

  const parentId = parsed.parent_tool_use_id ?? null;

  // SDK assistant message: { type: "assistant", message: { content: [...] } }
  if (parsed.type === "assistant" && parsed.message?.content) {
    // Check for authentication or API errors on the message
    if (parsed.error) {
      const hint = parsed.error === "authentication_failed"
        ? '\nRun "claude login" in your terminal to re-authenticate.'
        : "";
      entries.push({
        kind: "error",
        content: `API error: ${parsed.error}${hint}`,
        parentToolUseId: parentId,
      });
    }
    for (const block of parsed.message.content) {
      if (block.type === "thinking" && block.thinking) {
        entries.push({ kind: "thinking", content: block.thinking, parentToolUseId: parentId });
      } else if (block.type === "text" && block.text) {
        entries.push({ kind: "text", content: block.text, parentToolUseId: parentId });
      } else if (block.type === "tool_use") {
        if (block.name === "AskUserQuestion" && block.input?.questions) {
          entries.push({
            kind: "ask",
            toolId: block.id,
            questions: block.input.questions.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (q: any) => ({
                question: q.question,
                options: q.options ?? [],
                multiSelect: q.multiSelect ?? false,
              })
            ),
            parentToolUseId: parentId,
          });
        } else {
          entries.push({
            kind: "tool_call",
            toolName: block.name,
            toolId: block.id,
            summary: summarizeToolInput(block.name, block.input),
            parentToolUseId: parentId,
          });
        }
      }
    }
  }
  // SDK user message (tool results): { type: "user", message: { content: [...] } }
  else if (parsed.type === "user" && parsed.message?.content) {
    const content = parsed.message.content;
    const blocks = Array.isArray(content) ? content : [];
    for (const block of blocks) {
      if (block.type === "tool_result") {
        const text =
          typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((c: any) => c.text ?? "")
                  .filter(Boolean)
                  .join("\n")
              : "";
        entries.push({
          kind: "tool_result",
          toolId: block.tool_use_id,
          content: text,
          isError: !!block.is_error,
          parentToolUseId: parentId,
        });
      }
    }
  }
  // SDK tool_progress: { type: "tool_progress", tool_use_id, tool_name, elapsed_time_seconds, task_id? }
  else if (parsed.type === "tool_progress") {
    entries.push({
      kind: "tool_progress",
      toolUseId: parsed.tool_use_id,
      toolName: parsed.tool_name,
      elapsed: parsed.elapsed_time_seconds ?? 0,
      taskId: parsed.task_id,
      parentToolUseId: parentId,
    });
  }
  // SDK result message: { type: "result", subtype: "success"|"error_*", ... }
  else if (parsed.type === "result") {
    const parts: string[] = [];
    if (parsed.result) {
      parts.push(parsed.result);
    }
    if (parsed.is_error && parsed.errors?.length) {
      parts.push(...parsed.errors);
    }
    const cost = parsed.total_cost_usd != null
      ? `$${parsed.total_cost_usd.toFixed(4)}`
      : undefined;
    const duration = parsed.duration_ms != null
      ? `${(parsed.duration_ms / 1000).toFixed(1)}s`
      : undefined;
    if (parts.length > 0 || cost || duration) {
      entries.push({
        kind: "result",
        content: parts.join("\n") || (parsed.subtype === "success" ? "Completed" : `Error: ${parsed.subtype}`),
        cost,
        duration,
      });
    }
  }
  // SDK system messages
  else if (parsed.type === "system") {
    if (parsed.subtype === "init") {
      entries.push({
        kind: "system",
        content: `Session initialized (model: ${parsed.model ?? "unknown"}, session: ${parsed.session_id ?? "unknown"})`,
      });
    } else if (parsed.subtype === "task_started") {
      entries.push({
        kind: "system",
        content: `Task started: ${parsed.description ?? parsed.task_id}`,
        taskToolUseId: parsed.tool_use_id,
        taskStatus: "running",
        taskId: parsed.task_id,
      });
    } else if (parsed.subtype === "task_notification") {
      const usageInfo: string[] = [];
      if (parsed.usage) {
        if (parsed.usage.duration_ms) usageInfo.push(`${(parsed.usage.duration_ms / 1000).toFixed(1)}s`);
        if (parsed.usage.tool_uses) usageInfo.push(`${parsed.usage.tool_uses} tools`);
      }
      const usageSuffix = usageInfo.length > 0 ? ` (${usageInfo.join(", ")})` : "";
      const summary = parsed.summary ? `: ${parsed.summary}` : "";
      entries.push({
        kind: "system",
        content: `Task ${parsed.status}${summary}${usageSuffix}`,
        taskToolUseId: parsed.tool_use_id,
        taskStatus: parsed.status,
        taskSummary: parsed.summary || undefined,
        taskUsage: usageInfo.length > 0 ? usageInfo.join(", ") : undefined,
        taskId: parsed.task_id,
        taskOutputFile: parsed.output_file,
      });
    }
    // Other system subtypes (status, hook_*, compact_boundary) are silently skipped
  }
  // SDK tool_use_summary message
  else if (parsed.type === "tool_use_summary" && parsed.summary) {
    entries.push({ kind: "text", content: parsed.summary });
  }

  return entries;
}
