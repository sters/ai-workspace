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

export function listWorkspaces(): WorkspaceSummary[] {
  if (!fs.existsSync(WORKSPACE_DIR)) return [];

  const entries = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true });
  const workspaces: WorkspaceSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wsPath = path.join(WORKSPACE_DIR, entry.name);
    const readmePath = path.join(wsPath, "README.md");
    if (!fs.existsSync(readmePath)) continue;

    try {
      const summary = buildWorkspaceSummary(entry.name, wsPath);
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

export function getWorkspaceDetail(name: string): WorkspaceDetail | null {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(wsPath)) return null;

  const summary = buildWorkspaceSummary(name, wsPath);
  const readmePath = path.join(wsPath, "README.md");
  const readme = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, "utf-8")
    : "";

  const reviews = listReviewSessions(wsPath);

  return { ...summary, readme, reviews };
}

function buildWorkspaceSummary(
  name: string,
  wsPath: string
): WorkspaceSummary {
  const readmePath = path.join(wsPath, "README.md");
  const readmeContent = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, "utf-8")
    : "";

  const meta = parseReadmeMeta(readmeContent);
  const todos = listTodoFiles(wsPath);

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

function listTodoFiles(wsPath: string): TodoFile[] {
  const files = fs.readdirSync(wsPath).filter((f) => /^TODO-.*\.md$/.test(f));
  return files.map((f) => {
    const content = fs.readFileSync(path.join(wsPath, f), "utf-8");
    return parseTodoFile(f, content);
  });
}

function listReviewSessions(wsPath: string): ReviewSession[] {
  const reviewsDir = path.join(wsPath, "artifacts", "reviews");
  if (!fs.existsSync(reviewsDir)) return [];

  const entries = fs.readdirSync(reviewsDir, { withFileTypes: true });
  const sessions: ReviewSession[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const summaryPath = path.join(reviewsDir, entry.name, "SUMMARY.md");
    if (!fs.existsSync(summaryPath)) continue;

    try {
      const content = fs.readFileSync(summaryPath, "utf-8");
      sessions.push(parseReviewSummary(entry.name, content));
    } catch {
      // skip
    }
  }

  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return sessions;
}

export function getReadme(name: string): string | null {
  const p = path.join(WORKSPACE_DIR, name, "README.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null;
}

export function getTodos(name: string): TodoFile[] {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(wsPath)) return [];
  return listTodoFiles(wsPath);
}

export function getReviewSessions(name: string): ReviewSession[] {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(wsPath)) return [];
  return listReviewSessions(wsPath);
}

export function getReviewDetail(
  name: string,
  timestamp: string
): { summary: string; files: { name: string; content: string }[] } | null {
  const reviewDir = path.join(
    WORKSPACE_DIR,
    name,
    "artifacts",
    "reviews",
    timestamp
  );
  if (!fs.existsSync(reviewDir)) return null;

  const summaryPath = path.join(reviewDir, "SUMMARY.md");
  const summary = fs.existsSync(summaryPath)
    ? fs.readFileSync(summaryPath, "utf-8")
    : "";

  const files = fs
    .readdirSync(reviewDir)
    .filter((f) => f.endsWith(".md") && f !== "SUMMARY.md")
    .map((f) => ({
      name: f,
      content: fs.readFileSync(path.join(reviewDir, f), "utf-8"),
    }));

  return { summary, files };
}

export function getCommitDiff(name: string, hash: string): string | null {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(path.join(wsPath, ".git"))) return null;

  // Validate hash format to prevent injection
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return null;

  try {
    const { execSync } = require("node:child_process");
    return execSync(`git -C "${wsPath}" show ${hash} --format="" --patch`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function getHistory(name: string): HistoryEntry[] {
  const wsPath = path.join(WORKSPACE_DIR, name);
  if (!fs.existsSync(path.join(wsPath, ".git"))) return [];

  try {
    const { execSync } = require("node:child_process");
    const output = execSync(
      `git -C "${wsPath}" log --format="%H|%aI|%s|%an" -30`,
      { encoding: "utf-8" }
    );
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
