import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_DIR } from "./config";
import { parseTodoFile } from "./todo-parser";
import { parseReadmeMeta } from "./readme-parser";
import { parseReviewSummary } from "./review-parser";
import type {
  WorkspaceSummary,
  WorkspaceDetail,
  TodoFile,
  ReviewSession,
  HistoryEntry,
} from "@/types/workspace";

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  if (!fs.existsSync(WORKSPACE_DIR)) return [];

  const entries = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true });
  const workspaces: WorkspaceSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wsPath = path.join(WORKSPACE_DIR, entry.name);
    const readmeExists = await Bun.file(path.join(wsPath, "README.md")).exists();
    if (!readmeExists) continue;

    try {
      const summary = await buildWorkspaceSummary(entry.name, wsPath);
      workspaces.push(summary);
    } catch {
      // skip broken workspaces
    }
  }

  // Sort by last modified (most recent first)
  workspaces.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );

  return workspaces;
}

export async function getWorkspaceDetail(name: string): Promise<WorkspaceDetail | null> {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(wsPath)) return null;

  const summary = await buildWorkspaceSummary(name, wsPath);
  const readmeFile = Bun.file(path.join(wsPath, "README.md"));
  const readme = (await readmeFile.exists())
    ? await readmeFile.text()
    : "";

  const reviews = await listReviewSessions(wsPath);

  return { ...summary, readme, reviews };
}

async function buildWorkspaceSummary(
  name: string,
  wsPath: string
): Promise<WorkspaceSummary> {
  const readmeFile = Bun.file(path.join(wsPath, "README.md"));
  const readmeContent = (await readmeFile.exists())
    ? await readmeFile.text()
    : "";

  const meta = parseReadmeMeta(readmeContent);
  const todos = await listTodoFiles(wsPath);

  const totalCompleted = todos.reduce((s, t) => s + t.completed, 0);
  const totalItems = todos.reduce((s, t) => s + t.total, 0);
  const overallProgress =
    totalItems > 0 ? Math.round((totalCompleted * 100) / totalItems) : 0;

  const stat = fs.statSync(wsPath);

  return {
    name,
    path: wsPath,
    meta,
    todos,
    overallProgress,
    totalCompleted,
    totalItems,
    lastModified: stat.mtime.toISOString(),
  };
}

async function listTodoFiles(wsPath: string): Promise<TodoFile[]> {
  const files = fs.readdirSync(wsPath).filter((f) => /^TODO-.*\.md$/.test(f));
  return Promise.all(
    files.map(async (f) => {
      const content = await Bun.file(path.join(wsPath, f)).text();
      return parseTodoFile(f, content);
    })
  );
}

async function listReviewSessions(wsPath: string): Promise<ReviewSession[]> {
  const reviewsDir = path.join(wsPath, "artifacts", "reviews");
  if (!fs.existsSync(reviewsDir)) return [];

  const entries = fs.readdirSync(reviewsDir, { withFileTypes: true });
  const sessions: ReviewSession[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summaryFile = Bun.file(path.join(reviewsDir, entry.name, "SUMMARY.md"));
    if (!(await summaryFile.exists())) continue;

    try {
      const content = await summaryFile.text();
      sessions.push(parseReviewSummary(entry.name, content));
    } catch {
      // skip
    }
  }

  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sessions;
}

export async function getReadme(name: string): Promise<string | null> {
  const file = Bun.file(path.join(WORKSPACE_DIR, name, "README.md"));
  return (await file.exists()) ? file.text() : null;
}

export async function getTodos(name: string): Promise<TodoFile[]> {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(wsPath)) return [];
  return listTodoFiles(wsPath);
}

export async function getReviewSessions(name: string): Promise<ReviewSession[]> {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(wsPath)) return [];
  return listReviewSessions(wsPath);
}

export async function getReviewDetail(
  name: string,
  timestamp: string
): Promise<{ summary: string; files: { name: string; content: string }[] } | null> {
  const reviewDir = path.join(
    WORKSPACE_DIR,
    name,
    "artifacts",
    "reviews",
    timestamp
  );
  if (!fs.existsSync(reviewDir)) return null;

  const summaryFile = Bun.file(path.join(reviewDir, "SUMMARY.md"));
  const summary = (await summaryFile.exists())
    ? await summaryFile.text()
    : "";

  const fileNames = fs
    .readdirSync(reviewDir)
    .filter((f) => f.endsWith(".md") && f !== "SUMMARY.md");
  const files = await Promise.all(
    fileNames.map(async (f) => ({
      name: f,
      content: await Bun.file(path.join(reviewDir, f)).text(),
    }))
  );

  return { summary, files };
}

export function getCommitDiff(name: string, hash: string): string | null {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(path.join(wsPath, ".git"))) return null;

  // Validate hash format to prevent injection
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return null;

  try {
    const result = Bun.spawnSync(
      ["git", "-C", wsPath, "show", hash, "--format=", "--patch"],
    );
    return result.success ? result.stdout.toString() : null;
  } catch {
    return null;
  }
}

export function getHistory(name: string): HistoryEntry[] {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(path.join(wsPath, ".git"))) return [];

  try {
    const result = Bun.spawnSync(
      ["git", "-C", wsPath, "log", "--format=%H|%aI|%s|%an", "-30"],
    );
    if (!result.success) return [];
    const output = result.stdout.toString();
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        const [hash, date, message, author] = line.split("|");
        return { hash, date, message, author };
      });
  } catch {
    return [];
  }
}
