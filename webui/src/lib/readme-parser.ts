import fs from "node:fs";
import path from "node:path";
import type { WorkspaceMeta } from "@/types/workspace";

/**
 * Read README.md from a workspace path and parse its metadata.
 * Returns both the raw content and the parsed meta.
 */
export function readWorkspaceReadme(wsPath: string): { content: string; meta: WorkspaceMeta } {
  const content = fs.readFileSync(path.join(wsPath, "README.md"), "utf-8");
  return { content, meta: parseReadmeMeta(content) };
}

export function parseReadmeMeta(content: string): WorkspaceMeta {
  const titleMatch = content.match(/^#\s+Task:\s+(.+)$/m);
  const taskTypeMatch = content.match(/\*\*Task Type\*\*:\s*(\S+)/);
  const ticketIdMatch = content.match(/\*\*Ticket ID\*\*:\s*(\S+)/);
  const dateMatch = content.match(/\*\*Date\*\*:\s*(\S+)/);

  const repositories: WorkspaceMeta["repositories"] = [];
  const repoPattern =
    /- \*\*(\S+?)\*\*:\s*`([^`]+)`\s*\(base:\s*`([^`]+)`\)/g;
  let match;
  while ((match = repoPattern.exec(content)) !== null) {
    repositories.push({
      alias: match[1],
      path: match[2],
      baseBranch: match[3],
    });
  }

  return {
    title: titleMatch?.[1] ?? "Untitled",
    taskType: taskTypeMatch?.[1] ?? "unknown",
    ticketId: ticketIdMatch?.[1] ?? "",
    date: dateMatch?.[1] ?? "",
    repositories,
  };
}
