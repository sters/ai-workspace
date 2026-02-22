import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { WorkspaceSummary } from "@/types/workspace";
import { ProgressBar } from "../shared/progress-bar";
import { StatusBadge } from "../shared/status-badge";

export function WorkspaceCard({
  workspace,
  isRunning,
}: {
  workspace: WorkspaceSummary;
  isRunning?: boolean;
}) {
  const { name, meta, overallProgress, totalCompleted, totalItems } = workspace;

  return (
    <Link
      href={`/workspace/${encodeURIComponent(name)}`}
      className={`block rounded-lg border p-4 transition-colors hover:bg-accent/50${
        isRunning ? " border-primary/50" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          {isRunning && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          )}
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{meta.title}</h3>
            <p className="truncate text-xs text-muted-foreground">{name}</p>
          </div>
        </div>
        <StatusBadge label={meta.taskType} />
      </div>

      {meta.ticketId && (
        <p className="mb-2 text-xs text-muted-foreground">
          Ticket: {meta.ticketId}
        </p>
      )}

      <ProgressBar value={overallProgress} className="mb-1" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {totalCompleted}/{totalItems} items
        </span>
        <span>{meta.repositories.length} repos</span>
      </div>
    </Link>
  );
}
