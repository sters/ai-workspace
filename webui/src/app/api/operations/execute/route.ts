import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_DIR, resolveWorkspaceName } from "@/lib/config";
import { startOperation, startOperationGroup } from "@/lib/process-manager";
import { getReadme } from "@/lib/workspace";
import { parseReadmeMeta } from "@/lib/readme-parser";
import { listWorkspaceRepos } from "@/lib/workspace-ops";
import { buildExecutorPrompt, buildResearcherPrompt } from "@/lib/prompts";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace: rawWorkspace } = body as { workspace: string };
  if (!rawWorkspace) {
    return NextResponse.json(
      { error: "workspace is required" },
      { status: 400 }
    );
  }

  const workspace = resolveWorkspaceName(rawWorkspace);
  const readmeContent = getReadme(workspace) ?? "";
  const meta = parseReadmeMeta(readmeContent);
  const repos = listWorkspaceRepos(workspace);
  const wsPath = path.join(WORKSPACE_DIR, workspace);

  if (repos.length === 0) {
    return NextResponse.json(
      { error: "No repositories found in workspace" },
      { status: 400 }
    );
  }

  const isResearch =
    meta.taskType === "research" || meta.taskType === "investigation";

  if (isResearch) {
    const reportPath = path.join(wsPath, "artifacts", "research-report.md");
    const prompt = buildResearcherPrompt({
      workspaceName: workspace,
      readmeContent,
      repos: repos.map((r) => ({
        repoPath: r.repoPath,
        repoName: r.repoName,
        worktreePath: r.worktreePath,
      })),
      workspacePath: wsPath,
      reportPath,
    });

    const operation = startOperation("execute", workspace, prompt, {
      cwd: wsPath,
    });
    return NextResponse.json(operation);
  }

  // Feature/bugfix: launch one executor per repository
  const children = repos.map((repo) => {
    const todoFileName = `TODO-${repo.repoName}.md`;
    const todoPath = path.join(wsPath, todoFileName);
    const todoContent = fs.existsSync(todoPath)
      ? fs.readFileSync(todoPath, "utf-8")
      : "";

    const prompt = buildExecutorPrompt({
      workspaceName: workspace,
      repoPath: repo.repoPath,
      repoName: repo.repoName,
      readmeContent,
      todoContent,
      worktreePath: repo.worktreePath,
    });

    return {
      label: repo.repoName,
      prompt,
      options: { cwd: repo.worktreePath },
    };
  });

  const operation = startOperationGroup("execute", workspace, children);
  return NextResponse.json(operation);
}
