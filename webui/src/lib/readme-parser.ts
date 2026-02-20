import type { WorkspaceMeta } from "@/types/workspace";

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
