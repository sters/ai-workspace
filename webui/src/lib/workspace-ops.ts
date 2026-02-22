/**
 * Workspace operations — TypeScript equivalents of shell scripts.
 * All paths are relative to AI_WORKSPACE_ROOT unless otherwise noted.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AI_WORKSPACE_ROOT, WORKSPACE_DIR } from "./config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exec(cmd: string, opts?: { cwd?: string; maxBuffer?: number }): string {
  return execSync(cmd, {
    encoding: "utf-8",
    cwd: opts?.cwd ?? AI_WORKSPACE_ROOT,
    maxBuffer: opts?.maxBuffer ?? 10 * 1024 * 1024,
  }).trim();
}

function repoDir(): string {
  return path.join(AI_WORKSPACE_ROOT, "repositories");
}

/**
 * Convert any input string to a filesystem-safe ASCII slug.
 * - Replaces non-ASCII characters, spaces, and special chars with hyphens
 * - Collapses multiple hyphens
 * - Trims hyphens from start/end
 * - Lowercases everything
 * - Truncates to maxLength (default 50)
 * - Falls back to "workspace" if result is empty (e.g., pure non-ASCII input)
 */
function sanitizeSlug(input: string, maxLength = 50): string {
  let slug = input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")  // Replace non-ASCII, spaces, special chars with hyphens
    .replace(/-+/g, "-")          // Collapse multiple hyphens
    .replace(/^-+|-+$/g, "");     // Trim leading/trailing hyphens

  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-+$/, ""); // Trim trailing hyphens from truncation
  }

  return slug || "workspace";
}

// ---------------------------------------------------------------------------
// analyzeTaskDescription — ask Claude to extract structured metadata
// ---------------------------------------------------------------------------

import { runClaude } from "./claude-sdk";

export interface TaskAnalysis {
  taskType: string;
  slug: string;
  ticketId: string;
  repositories: string[];
}

export async function analyzeTaskDescription(
  description: string,
): Promise<TaskAnalysis> {
  return new Promise<TaskAnalysis>((resolve) => {
    let textOutput = "";
    let resolved = false;

    const fallback: TaskAnalysis = {
      taskType: "feature",
      slug: sanitizeSlug(description),
      ticketId: "",
      repositories: [],
    };

    const safeResolve = (value: TaskAnalysis) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const process = runClaude(
      `analyze-${Date.now()}`,
      `Analyze the following task description and extract structured metadata. Reply with ONLY a JSON object, no explanation, no markdown fences.

JSON schema:
{
  "taskType": "feature" | "bugfix" | "research" | "investigation",
  "slug": "short-english-slug (2-5 lowercase words, hyphen-separated)",
  "ticketId": "ticket ID if found (e.g. PROJ-123, #456), or empty string",
  "repositories": ["github.com/org/repo", ...] (full paths found in description, or empty array)
}

Rules:
- taskType: infer from context. Default to "feature" if unclear.
- slug: concise English directory name for the workspace. Do NOT include the ticket ID in the slug.
- ticketId: extract Jira IDs (XX-123), GitHub issue refs (#123 or org/repo#123), Linear IDs, etc. Empty string if none.
- repositories: extract repository paths like "github.com/org/repo". Include the host. Empty array if none mentioned.

Task description:
${description}`,
    );

    process.onEvent((event) => {
      if (event.type === "output") {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "assistant" && data.message?.content) {
            for (const block of data.message.content) {
              if (block.type === "text") {
                textOutput += block.text;
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
      if (event.type === "complete" || event.type === "error") {
        try {
          // Strip markdown fences if present
          const cleaned = textOutput.trim().replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
          const parsed = JSON.parse(cleaned);
          safeResolve({
            taskType: parsed.taskType || fallback.taskType,
            slug: sanitizeSlug(parsed.slug || "") || fallback.slug,
            ticketId: parsed.ticketId || "",
            repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [],
          });
        } catch {
          safeResolve(fallback);
        }
      }
    });

    // Timeout after 30 seconds — fall back to defaults
    setTimeout(() => safeResolve(fallback), 30000);
  });
}

// ---------------------------------------------------------------------------
// README Template
// ---------------------------------------------------------------------------

const README_TEMPLATE = `# Task: {{DESCRIPTION}}

## Overview

**Task Type**: {{TASK_TYPE}}
**Ticket ID**: {{TICKET_ID}}
**Date**: {{DATE}}

## Workspace Structure

| Path | Description |
|------|-------------|
| \`README.md\` | Task overview, objectives, requirements, and context. Updated throughout the task. |
| \`TODO-{repo}.md\` | Checklist of tasks for each repository. Created by planner agent. |
| \`artifacts/\` | **Persistent directory for keeping important outputs.** Research results, investigation notes, reference materials, etc. Git-tracked. |
| \`tmp/\` | **Temporary directory for agent use.** Intermediate files, scratch work, etc. Contents are gitignored. |
| \`artifacts/reviews/\` | Code review reports. |
| \`{org}/{repo}/\` | Git worktrees for each repository. Work is done here. |

This workspace is a git repository. Changes to \`README.md\`, \`TODO-*.md\`, and \`artifacts/\` (including \`artifacts/reviews/\`) are tracked. Use \`git log\` to view history.

**Gitignored:** \`tmp/\`, \`*.tmp\`, \`*.log\`, repository worktrees (\`github.com/\`, \`gitlab.com/\`, \`bitbucket.org/\`)

## Repositories

<!-- Fill in before running setup-repository.sh -->

## Objective

<!-- Describe what needs to be accomplished -->

## Context

<!-- Background information and why this task is needed -->

## Requirements

<!-- Specific requirements and acceptance criteria -->

## Related Resources

<!-- Links to issues, documentation, etc. -->
`;

const GITIGNORE_CONTENT = `# Exclude repository worktrees (they are separate git repos)
github.com/
gitlab.com/
bitbucket.org/

# Exclude temporary files
tmp/
*.tmp
*.log
`;

// ---------------------------------------------------------------------------
// setupWorkspace
// ---------------------------------------------------------------------------

export interface SetupWorkspaceResult {
  workspaceName: string;
  workspacePath: string;
}

export function setupWorkspace(
  taskType: string,
  description: string,
  ticketId?: string,
  preGeneratedSlug?: string,
): SetupWorkspaceResult {
  // Use pre-generated slug if provided, otherwise sanitize the description
  let slug = preGeneratedSlug
    ? sanitizeSlug(preGeneratedSlug)
    : sanitizeSlug(description);

  // Strip ticket ID from slug if already provided separately
  if (ticketId) {
    const tLower = ticketId.toLowerCase();
    slug = slug
      .replace(new RegExp(`^${tLower}-`), "")
      .replace(new RegExp(`-${tLower}-`, "g"), "-")
      .replace(new RegExp(`-${tLower}$`), "");
    if (slug === tLower) slug = "";
    slug = slug.replace(/^-+|-+$/g, "");
    if (!slug) slug = "workspace";
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dirName = ticketId
    ? `${taskType}-${ticketId}-${slug}-${date}`
    : `${taskType}-${slug}-${date}`;

  const wsPath = path.join(WORKSPACE_DIR, dirName);

  // Create directories
  fs.mkdirSync(wsPath, { recursive: true });
  fs.mkdirSync(path.join(wsPath, "tmp"), { recursive: true });
  fs.mkdirSync(path.join(wsPath, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(wsPath, "artifacts", ".gitkeep"), "");

  // Initialize git
  exec(`git init --quiet "${wsPath}"`);

  // Write .gitignore
  fs.writeFileSync(path.join(wsPath, ".gitignore"), GITIGNORE_CONTENT);

  // Write README from template
  const dateFormatted = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const readme = README_TEMPLATE
    .replace(/\{\{DESCRIPTION\}\}/g, description)
    .replace(/\{\{TASK_TYPE\}\}/g, taskType)
    .replace(/\{\{TICKET_ID\}\}/g, ticketId ?? "N/A")
    .replace(/\{\{DATE\}\}/g, dateFormatted);
  fs.writeFileSync(path.join(wsPath, "README.md"), readme);

  // Initial commit
  exec(`git -C "${wsPath}" add .gitignore README.md artifacts/`);
  exec(`git -C "${wsPath}" commit --quiet -m "Initial: ${dirName} workspace created"`);

  return { workspaceName: dirName, workspacePath: wsPath };
}

// ---------------------------------------------------------------------------
// detectBaseBranch
// ---------------------------------------------------------------------------

export function detectBaseBranch(repoAbsPath: string): string {
  // 1. symbolic-ref
  try {
    const ref = exec(
      `git -C "${repoAbsPath}" symbolic-ref refs/remotes/origin/HEAD`,
    );
    const branch = ref.replace(/^refs\/remotes\/origin\//, "");
    if (branch) return branch;
  } catch { /* continue */ }

  // 2. set-head --auto
  try {
    exec(`git -C "${repoAbsPath}" remote set-head origin --auto`);
    const ref = exec(
      `git -C "${repoAbsPath}" symbolic-ref refs/remotes/origin/HEAD`,
    );
    const branch = ref.replace(/^refs\/remotes\/origin\//, "");
    if (branch) return branch;
  } catch { /* continue */ }

  // 3. common branch names
  for (const b of ["main", "master", "develop", "development"]) {
    try {
      exec(
        `git -C "${repoAbsPath}" show-ref --verify --quiet refs/remotes/origin/${b}`,
      );
      return b;
    } catch { /* continue */ }
  }

  // 4. current branch
  try {
    const current = exec(`git -C "${repoAbsPath}" rev-parse --abbrev-ref HEAD`);
    if (current && current !== "HEAD") return current;
  } catch { /* continue */ }

  throw new Error(`Could not determine base branch for ${repoAbsPath}`);
}

// ---------------------------------------------------------------------------
// setupRepository
// ---------------------------------------------------------------------------

export interface SetupRepositoryResult {
  repoPath: string; // e.g. github.com/org/repo
  repoName: string; // e.g. repo
  worktreePath: string; // absolute path
  baseBranch: string;
  branchName: string;
}

export function setupRepository(
  workspaceName: string,
  repositoryPathArg: string,
  baseBranchOverride?: string,
): SetupRepositoryResult {
  // Parse alias syntax (e.g. github.com/org/repo:dev)
  let actualRepoPath = repositoryPathArg;
  let repoAlias = "";
  let repoPathInput = repositoryPathArg;
  if (repositoryPathArg.includes(":")) {
    actualRepoPath = repositoryPathArg.split(":")[0];
    repoAlias = repositoryPathArg.split(":").slice(1).join(":");
    repoPathInput = `${actualRepoPath}___${repoAlias}`;
  }

  const repoName = path.basename(repoPathInput);
  const repoAbsPath = path.join(repoDir(), actualRepoPath);
  const wsPath = path.join(WORKSPACE_DIR, workspaceName);

  if (!fs.existsSync(wsPath)) {
    throw new Error(`Workspace directory does not exist: ${wsPath}`);
  }

  // Clone or fetch
  if (!fs.existsSync(repoAbsPath)) {
    const parentDir = path.dirname(repoAbsPath);
    fs.mkdirSync(parentDir, { recursive: true });
    const repoUrl = `https://${actualRepoPath}.git`;
    exec(`git clone "${repoUrl}" "${repoAbsPath}"`);
    try {
      exec(`git -C "${repoAbsPath}" remote set-head origin --auto`);
    } catch { /* non-critical */ }
  } else {
    exec(`git -C "${repoAbsPath}" fetch --all --prune`);
    try {
      exec(`git -C "${repoAbsPath}" remote set-head origin --auto`);
    } catch { /* non-critical */ }
  }

  // Detect base branch
  const baseBranch = baseBranchOverride ?? detectBaseBranch(repoAbsPath);

  // Extract task info from workspace name for branch naming
  const parts = workspaceName.split("-");
  const taskType = parts[0];
  const dateMatch = workspaceName.match(/(\d{8})$/);
  const date = dateMatch?.[1] ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // Detect ticket ID
  let ticketId = "";
  let description = "";
  if (parts.length > 1 && /^[A-Z]+[-]?\d+$/i.test(parts[1])) {
    ticketId = parts[1];
    description = workspaceName
      .replace(new RegExp(`^${taskType}-${ticketId}-`), "")
      .replace(new RegExp(`-${date}$`), "");
  } else {
    description = workspaceName
      .replace(new RegExp(`^${taskType}-`), "")
      .replace(new RegExp(`-${date}$`), "");
  }

  // Build branch name
  let branchName: string;
  if (ticketId) {
    branchName = repoAlias
      ? `${taskType}/${ticketId}-${description}-${repoAlias}`
      : `${taskType}/${ticketId}-${description}`;
  } else {
    branchName = repoAlias
      ? `${taskType}/${description}-${repoAlias}`
      : `${taskType}/${description}-${date}`;
  }

  // Create worktree
  const worktreePath = path.join(wsPath, repoPathInput);
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  exec(
    `git -C "${repoAbsPath}" worktree add -b "${branchName}" "${worktreePath}" "origin/${baseBranch}"`,
  );

  return {
    repoPath: repoPathInput,
    repoName,
    worktreePath,
    baseBranch,
    branchName,
  };
}

// ---------------------------------------------------------------------------
// listWorkspaceRepos
// ---------------------------------------------------------------------------

export interface WorkspaceRepo {
  /** e.g. github.com/org/repo */
  repoPath: string;
  /** e.g. repo */
  repoName: string;
  /** absolute path to worktree */
  worktreePath: string;
}

export function listWorkspaceRepos(workspaceName: string): WorkspaceRepo[] {
  const wsPath = path.join(WORKSPACE_DIR, workspaceName);
  if (!fs.existsSync(wsPath)) return [];

  const repos: WorkspaceRepo[] = [];

  // Find directories containing .git (regular repos or worktrees) up to 4 levels deep
  function walk(dir: string, depth: number) {
    if (depth > 4) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "artifacts" || entry.name === "tmp" || entry.name === ".git") continue;
      const fullPath = path.join(dir, entry.name);
      if (!entry.isDirectory()) continue;

      // Check for .git (directory or file — worktrees use a file)
      const gitPath = path.join(fullPath, ".git");
      if (fs.existsSync(gitPath)) {
        const relPath = path.relative(wsPath, fullPath);
        repos.push({
          repoPath: relPath,
          repoName: path.basename(relPath),
          worktreePath: fullPath,
        });
      } else {
        walk(fullPath, depth + 1);
      }
    }
  }

  walk(wsPath, 1);
  repos.sort((a, b) => a.repoPath.localeCompare(b.repoPath));
  return repos;
}

// ---------------------------------------------------------------------------
// commitWorkspaceSnapshot
// ---------------------------------------------------------------------------

export function commitWorkspaceSnapshot(
  workspaceName: string,
  message?: string,
): boolean {
  const wsPath = path.join(WORKSPACE_DIR, workspaceName);
  if (!fs.existsSync(path.join(wsPath, ".git"))) return false;

  // Check for changes
  try {
    exec(`git -C "${wsPath}" diff --quiet HEAD -- README.md`);
    exec(`git -C "${wsPath}" diff --cached --quiet -- README.md`);
    // Also check TODO and artifacts
    try { exec(`git -C "${wsPath}" diff --quiet HEAD -- . -- ':!github.com' ':!gitlab.com' ':!bitbucket.org' ':!tmp'`); } catch { /* has changes */ }
  } catch { /* has changes, proceed */ }

  // Stage changes
  try { exec(`git -C "${wsPath}" add README.md`); } catch { /* no README */ }
  try { exec(`git -C "${wsPath}" add "TODO-*.md" 2>/dev/null || true`); } catch { /* no TODOs */ }
  // Use shell glob for TODO files
  const todoFiles = fs.readdirSync(wsPath).filter(f => /^TODO-.*\.md$/.test(f));
  for (const f of todoFiles) {
    try { exec(`git -C "${wsPath}" add "${f}"`); } catch { /* ignore */ }
  }
  try { exec(`git -C "${wsPath}" add artifacts/`); } catch { /* no artifacts */ }

  // Check if there are staged changes
  try {
    exec(`git -C "${wsPath}" diff --cached --quiet`);
    return false; // no changes
  } catch { /* has staged changes, proceed */ }

  // Auto-generate message if not provided
  let commitMsg = message;
  if (!commitMsg) {
    let completed = 0;
    let total = 0;
    for (const f of todoFiles) {
      const content = fs.readFileSync(path.join(wsPath, f), "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (/^\s*- \[x\]/.test(line)) { completed++; total++; }
        else if (/^\s*- \[ \]/.test(line)) { total++; }
        else if (/^\s*- \[!\]/.test(line)) { total++; }
        else if (/^\s*- \[~\]/.test(line)) { total++; }
      }
    }
    commitMsg = total > 0
      ? `Snapshot: ${completed}/${total} TODO items completed`
      : "Snapshot: workspace updated";
  }

  exec(`git -C "${wsPath}" commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
  return true;
}

// ---------------------------------------------------------------------------
// deleteWorkspace
// ---------------------------------------------------------------------------

export function deleteWorkspace(workspaceName: string): void {
  const wsPath = path.join(WORKSPACE_DIR, workspaceName);
  if (!fs.existsSync(wsPath)) {
    throw new Error(`Workspace directory not found: ${wsPath}`);
  }

  // Collect repository paths that have worktrees
  const repoPaths: string[] = [];
  const repos = listWorkspaceRepos(workspaceName);
  for (const repo of repos) {
    const repoSource = path.join(repoDir(), repo.repoPath);
    if (fs.existsSync(repoSource)) {
      repoPaths.push(repoSource);
    }
  }

  // Remove workspace directory
  fs.rmSync(wsPath, { recursive: true, force: true });

  // Prune worktree references
  for (const rp of repoPaths) {
    try {
      exec(`git -C "${rp}" worktree prune`);
    } catch { /* non-critical */ }
  }
}

// ---------------------------------------------------------------------------
// listStaleWorkspaces
// ---------------------------------------------------------------------------

export interface StaleWorkspace {
  name: string;
  lastModified: Date;
}

export function listStaleWorkspaces(days: number): StaleWorkspace[] {
  if (!fs.existsSync(WORKSPACE_DIR)) return [];

  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true });
  const stale: StaleWorkspace[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wsPath = path.join(WORKSPACE_DIR, entry.name);
    const stat = fs.statSync(wsPath);
    if (stat.mtime.getTime() < threshold) {
      stale.push({ name: entry.name, lastModified: stat.mtime });
    }
  }

  return stale.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
}

// ---------------------------------------------------------------------------
// listAllWorkspacesWithAge
// ---------------------------------------------------------------------------

export interface WorkspaceAgeInfo {
  name: string;
  lastModified: Date;
  ageDays: number;
  isStale: boolean;
}

export function listAllWorkspacesWithAge(staleDays: number): WorkspaceAgeInfo[] {
  if (!fs.existsSync(WORKSPACE_DIR)) return [];

  const now = Date.now();
  const entries = fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true });
  const result: WorkspaceAgeInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const wsPath = path.join(WORKSPACE_DIR, entry.name);
    const stat = fs.statSync(wsPath);
    const ageDays = Math.floor((now - stat.mtime.getTime()) / (24 * 60 * 60 * 1000));
    result.push({
      name: entry.name,
      lastModified: stat.mtime,
      ageDays,
      isStale: ageDays >= staleDays,
    });
  }

  return result.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
}

// ---------------------------------------------------------------------------
// prepareReviewDir
// ---------------------------------------------------------------------------

export function prepareReviewDir(workspaceName: string): string {
  const wsPath = path.join(WORKSPACE_DIR, workspaceName);
  if (!fs.existsSync(wsPath)) {
    throw new Error(`Workspace directory not found: ${wsPath}`);
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");

  const reviewDir = path.join(wsPath, "artifacts", "reviews", timestamp);
  fs.mkdirSync(reviewDir, { recursive: true });
  return timestamp;
}

// ---------------------------------------------------------------------------
// checkExistingPR
// ---------------------------------------------------------------------------

export interface ExistingPR {
  exists: boolean;
  url?: string;
  title?: string;
  body?: string;
}

export function checkExistingPR(worktreePath: string): ExistingPR {
  try {
    const url = exec(`gh pr view --json url -q ".url"`, { cwd: worktreePath });
    const title = exec(`gh pr view --json title -q ".title"`, { cwd: worktreePath });
    const body = exec(`gh pr view --json body -q ".body"`, { cwd: worktreePath });
    return { exists: true, url, title, body };
  } catch {
    return { exists: false };
  }
}

// ---------------------------------------------------------------------------
// getRepoChanges
// ---------------------------------------------------------------------------

export interface RepoChanges {
  currentBranch: string;
  changedFiles: string;
  diffStat: string;
  commitLog: string;
}

export function getRepoChanges(
  workspaceName: string,
  repoPath: string,
  baseBranch: string,
): RepoChanges {
  const worktreePath = path.join(WORKSPACE_DIR, workspaceName, repoPath);

  // Fetch latest
  try {
    exec(`git -C "${worktreePath}" fetch origin "${baseBranch}"`);
  } catch {
    try { exec(`git -C "${worktreePath}" fetch origin`); } catch { /* ignore */ }
  }

  const currentBranch = (() => {
    try { return exec(`git -C "${worktreePath}" branch --show-current`); }
    catch { return "(unknown)"; }
  })();

  const changedFiles = (() => {
    try { return exec(`git -C "${worktreePath}" diff --name-status "origin/${baseBranch}...HEAD"`); }
    catch { return "(no changes)"; }
  })();

  const diffStat = (() => {
    try { return exec(`git -C "${worktreePath}" diff --stat "origin/${baseBranch}...HEAD"`); }
    catch { return "(no changes)"; }
  })();

  const commitLog = (() => {
    try { return exec(`git -C "${worktreePath}" log --oneline "origin/${baseBranch}...HEAD"`); }
    catch { return "(no commits)"; }
  })();

  return { currentBranch, changedFiles, diffStat, commitLog };
}
