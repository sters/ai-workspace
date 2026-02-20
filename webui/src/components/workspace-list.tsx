"use client";

import { useWorkspaces } from "@/hooks/use-workspaces";
import { WorkspaceCard } from "./workspace-card";

export function WorkspaceList() {
  const { workspaces, isLoading, error } = useWorkspaces();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-lg border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load workspaces.
      </p>
    );
  }

  if (workspaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No workspaces found. Create one using <code>/workspace-init</code> in
        Claude Code.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workspaces.map((ws) => (
        <WorkspaceCard key={ws.name} workspace={ws} />
      ))}
    </div>
  );
}
