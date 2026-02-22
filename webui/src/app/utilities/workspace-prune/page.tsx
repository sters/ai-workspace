"use client";

import { useState } from "react";

interface PruneResult {
  success: boolean;
  days: number;
  deleted: string[];
  failed: { name: string; error: string }[];
}

export default function WorkspacePrunePage() {
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PruneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/operations/workspace-prune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days) || 7 }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data: PruneResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Workspace Prune</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Delete workspaces not modified within the specified number of days.
      </p>

      <div className="mb-4 flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Days</label>
          <input
            type="number"
            placeholder="7"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={loading}
            className="w-32 rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <p>
              Pruned workspaces older than{" "}
              <span className="font-semibold">{result.days}</span> days.
            </p>
            {result.deleted.length === 0 && result.failed.length === 0 && (
              <p className="mt-1 text-muted-foreground">
                No stale workspaces found.
              </p>
            )}
          </div>

          {result.deleted.length > 0 && (
            <div className="rounded-md border border-green-300 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950">
              <h3 className="mb-1 text-sm font-medium text-green-800 dark:text-green-200">
                Deleted ({result.deleted.length})
              </h3>
              <ul className="list-inside list-disc text-sm text-green-700 dark:text-green-300">
                {result.deleted.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.failed.length > 0 && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950">
              <h3 className="mb-1 text-sm font-medium text-red-800 dark:text-red-200">
                Failed ({result.failed.length})
              </h3>
              <ul className="list-inside list-disc text-sm text-red-700 dark:text-red-300">
                {result.failed.map((f) => (
                  <li key={f.name}>
                    {f.name}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
