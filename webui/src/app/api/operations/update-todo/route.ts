import { NextResponse } from "next/server";
import { startOperation } from "@/lib/process-manager";
import { listWorkspaceRepos } from "@/lib/workspace-ops";
import { WORKSPACE_DIR, resolveWorkspaceName } from "@/lib/config";
import { buildUpdaterPrompt } from "@/lib/prompts";
import fs from "node:fs";
import path from "node:path";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace: rawWorkspace, instruction } = body as {
    workspace: string;
    instruction: string;
  };
  if (!rawWorkspace || !instruction) {
    return NextResponse.json(
      { error: "workspace and instruction are required" },
      { status: 400 }
    );
  }

  const workspace = resolveWorkspaceName(rawWorkspace);
  const workspacePath = path.join(WORKSPACE_DIR, workspace);

  const readmePath = path.join(workspacePath, "README.md");
  const readmeContent = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, "utf-8")
    : "";

  const repos = listWorkspaceRepos(workspace);

  const prompts = repos.map((repo) => {
    const todoPath = path.join(workspacePath, `TODO-${repo.repoName}.md`);
    const todoContent = fs.existsSync(todoPath)
      ? fs.readFileSync(todoPath, "utf-8")
      : "";

    return buildUpdaterPrompt({
      workspaceName: workspace,
      repoName: repo.repoName,
      readmeContent,
      todoContent,
      worktreePath: repo.worktreePath,
      workspacePath,
      instruction,
    });
  });

  const prompt =
    prompts.length === 1
      ? prompts[0]
      : prompts
          .map((p, i) => `# Repo ${i + 1} of ${prompts.length}\n\n${p}`)
          .join("\n\n---\n\n");

  const operation = startOperation("update-todo", workspace, prompt);
  return NextResponse.json(operation);
}
