import { NextResponse } from "next/server";
import { resolveWorkspaceName } from "@/lib/config";
import { startOperationPipeline } from "@/lib/process-manager";
import { getReadme } from "@/lib/workspace";
import { parseReadmeMeta } from "@/lib/readme-parser";
import {
  listWorkspaceRepos,
  detectBaseBranch,
  getRepoChanges,
  checkExistingPR,
} from "@/lib/workspace-ops";
import { buildPRCreatorPrompt } from "@/lib/prompts";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspace: rawWorkspace, draft } = body as { workspace: string; draft?: boolean };
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

  if (repos.length === 0) {
    return NextResponse.json(
      { error: "No repositories found in workspace" },
      { status: 400 }
    );
  }

  const children = repos.map((repo) => {
    // Detect base branch from README metadata or repo itself
    const metaRepo = meta.repositories.find(
      (r) => r.path === repo.repoPath || r.alias === repo.repoName,
    );
    const baseBranch = metaRepo?.baseBranch ?? detectBaseBranch(repo.worktreePath);

    const changes = getRepoChanges(workspace, repo.repoPath, baseBranch);
    const existingPR = checkExistingPR(repo.worktreePath);

    const prompt = buildPRCreatorPrompt({
      workspaceName: workspace,
      repoPath: repo.repoPath,
      repoName: repo.repoName,
      baseBranch,
      worktreePath: repo.worktreePath,
      readmeContent,
      repoChanges: `Branch: ${changes.currentBranch}\n\nChanged files:\n${changes.changedFiles}\n\nDiff stat:\n${changes.diffStat}\n\nCommit log:\n${changes.commitLog}`,
      draft: draft !== false,
      existingPR: existingPR.exists
        ? { url: existingPR.url!, title: existingPR.title!, body: existingPR.body! }
        : undefined,
    });

    return {
      label: repo.repoName,
      prompt,
      options: { cwd: repo.worktreePath },
    };
  });

  const operation = startOperationPipeline("create-pr", workspace, [
    { kind: "group", children },
  ]);
  return NextResponse.json(operation);
}
