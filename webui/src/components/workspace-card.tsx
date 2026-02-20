import Link from "next/link";
import type { WorkspaceSummary } from "@/types/workspace";
import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";

export function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  const { name, meta, overallProgress, totalCompleted, totalItems } = workspace;

  return (
    <Link
      href={`/workspace/${encodeURIComponent(name)}`}
      className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{meta.title}</h3>
          <p className="truncate text-xs text-muted-foreground">{name}</p>
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
