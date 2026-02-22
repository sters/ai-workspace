import useSWR from "swr";
import type { Operation } from "@/types/operation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRunningOperations() {
  const { data } = useSWR<Operation[]>("/api/operations", fetcher, {
    refreshInterval: 3000,
  });

  const runningWorkspaces = new Set<string>();
  for (const op of data ?? []) {
    if (op.status === "running") {
      runningWorkspaces.add(op.workspace);
    }
  }

  return { runningWorkspaces };
}
