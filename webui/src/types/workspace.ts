export interface TodoItem {
  text: string;
  status: "completed" | "pending" | "blocked" | "in_progress";
  indent: number;
  children: string[];
}

export interface TodoSection {
  heading: string;
  items: TodoItem[];
  notes: string[];
}

export interface TodoFile {
  filename: string;
  repoName: string;
  items: TodoItem[];
  sections: TodoSection[];
  completed: number;
  pending: number;
  blocked: number;
  inProgress: number;
  total: number;
  progress: number;
}

export interface WorkspaceMeta {
  title: string;
  taskType: string;
  ticketId: string;
  date: string;
  repositories: { alias: string; path: string; baseBranch: string }[];
}

export interface ReviewSession {
  timestamp: string;
  repos: number;
  critical: number;
  warnings: number;
  suggestions: number;
}

export interface WorkspaceSummary {
  name: string;
  path: string;
  meta: WorkspaceMeta;
  todos: TodoFile[];
  overallProgress: number;
  totalCompleted: number;
  totalItems: number;
  lastModified: string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  readme: string;
  reviews: ReviewSession[];
}

export interface HistoryEntry {
  hash: string;
  date: string;
  message: string;
  author: string;
}
