import useSWR from "swr";
import type { WorkspaceSummary } from "@/types/workspace";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useWorkspaces() {
  const { data, error, isLoading, mutate } = useSWR<WorkspaceSummary[]>(
    "/api/workspaces",
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    workspaces: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
