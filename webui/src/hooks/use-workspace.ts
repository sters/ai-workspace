import useSWR from "swr";
import type { WorkspaceDetail, TodoFile, ReviewSession, HistoryEntry } from "@/types/workspace";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useWorkspace(name: string) {
  const { data, error, isLoading, mutate } = useSWR<WorkspaceDetail>(
    name ? `/api/workspaces/${encodeURIComponent(name)}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  return { workspace: data, isLoading, error, refresh: mutate };
}

export function useTodos(name: string) {
  const { data, error, isLoading } = useSWR<TodoFile[]>(
    name ? `/api/workspaces/${encodeURIComponent(name)}/todos` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  return { todos: data ?? [], isLoading, error };
}

export function useReviews(name: string) {
  const { data, error, isLoading } = useSWR<ReviewSession[]>(
    name ? `/api/workspaces/${encodeURIComponent(name)}/reviews` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  return { reviews: data ?? [], isLoading, error };
}

export function useHistory(name: string) {
  const { data, error, isLoading } = useSWR<HistoryEntry[]>(
    name ? `/api/workspaces/${encodeURIComponent(name)}/history` : null,
    fetcher
  );

  return { history: data ?? [], isLoading, error };
}

export function useReviewDetail(name: string, timestamp: string | null) {
  const { data, error, isLoading } = useSWR(
    name && timestamp
      ? `/api/workspaces/${encodeURIComponent(name)}/reviews/${timestamp}`
      : null,
    fetcher
  );

  return {
    summary: data?.summary as string | undefined,
    files: data?.files as { name: string; content: string }[] | undefined,
    isLoading,
    error,
  };
}
