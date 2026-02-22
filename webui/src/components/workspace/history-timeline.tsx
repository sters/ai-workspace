"use client";

import { useState, useCallback, useEffect } from "react";
import type { HistoryEntry } from "@/types/workspace";
import { useHistory } from "@/hooks/use-workspace";

function DiffLine({ line }: { line: string }) {
  let className = "whitespace-pre-wrap break-all";
  if (line.startsWith("+")) {
    className += " text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950";
  } else if (line.startsWith("-")) {
    className += " text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950";
  } else if (line.startsWith("@@")) {
    className += " text-blue-600 dark:text-blue-400";
  } else if (line.startsWith("diff ")) {
    className += " font-bold text-muted-foreground";
  }
  return <div className={className}>{line}</div>;
}

function CommitDiff({
  workspaceName,
  hash,
}: {
  workspaceName: string;
  hash: string;
}) {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(
      `/api/workspaces/${encodeURIComponent(workspaceName)}/history/${encodeURIComponent(hash)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => {
        setDiff(data.diff);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [workspaceName, hash]);

  if (loading) {
    return (
      <p className="py-2 text-xs text-muted-foreground">Loading diff...</p>
    );
  }

  if (error || diff === null) {
    return (
      <p className="py-2 text-xs text-red-500">Failed to load diff.</p>
    );
  }

  if (diff.trim() === "") {
    return (
      <p className="py-2 text-xs text-muted-foreground">No changes in this commit.</p>
    );
  }

  const lines = diff.split("\n");

  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded border border-border bg-muted/50 p-2 text-xs leading-relaxed">
      {lines.map((line, i) => (
        <DiffLine key={i} line={line} />
      ))}
    </pre>
  );
}

export function HistoryTimeline({ workspaceName }: { workspaceName: string }) {
  const { history, isLoading } = useHistory(workspaceName);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);

  const toggleDiff = useCallback((hash: string) => {
    setExpandedHash((prev) => (prev === hash ? null : hash));
  }, []);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No history found.</p>;
  }

  return (
    <div className="space-y-0">
      {history.map((entry: HistoryEntry) => (
        <div key={entry.hash} className="border-l-2 border-border py-2 pl-4">
          <button
            type="button"
            className="flex w-full cursor-pointer gap-3 text-left hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
            onClick={() => toggleDiff(entry.hash)}
          >
            <div className="flex-1">
              <p className="text-sm">{entry.message}</p>
              <p className="text-xs text-muted-foreground">
                {entry.hash.slice(0, 7)} &middot;{" "}
                {new Date(entry.date).toLocaleString()}
              </p>
            </div>
            <span className="text-xs text-muted-foreground self-center">
              {expandedHash === entry.hash ? "\u25B2" : "\u25BC"}
            </span>
          </button>
          {expandedHash === entry.hash && (
            <CommitDiff workspaceName={workspaceName} hash={entry.hash} />
          )}
        </div>
      ))}
    </div>
  );
}
