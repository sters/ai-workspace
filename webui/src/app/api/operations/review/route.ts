import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_DIR, resolveWorkspaceName } from "@/lib/config";
import { startOperationPipeline } from "@/lib/process-manager";
import { getReadme } from "@/lib/workspace";
import { parseReadmeMeta } from "@/lib/readme-parser";
import {
  listWorkspaceRepos,
  detectBaseBranch,
  getRepoChanges,
  prepareReviewDir,
} from "@/lib/workspace-ops";
import {
  buildCodeReviewerPrompt,
  buildTodoVerifierPrompt,
  buildCollectorPrompt,
} from "@/lib/prompts";
import type { PipelinePhase, GroupChild } from "@/lib/process-manager";

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
  const readmeContent = (await getReadme(workspace)) ?? "";
  const meta = parseReadmeMeta(readmeContent);
  const repos = listWorkspaceRepos(workspace);
  const wsPath = path.join(WORKSPACE_DIR, workspace);

  if (repos.length === 0) {
    return NextResponse.json(
      { error: "No repositories found in workspace" },
      { status: 400 }
    );
  }

  const reviewTimestamp = prepareReviewDir(workspace);
  const reviewDir = path.join(wsPath, "artifacts", "reviews", reviewTimestamp);

  // Build review + verify children for phase 1 (parallel)
  const reviewChildren: GroupChild[] = [];
  const reviewFileNames: string[] = [];
  const verifyFileNames: string[] = [];

  for (const repo of repos) {
    const metaRepo = meta.repositories.find(
      (r) => r.path === repo.repoPath || r.alias === repo.repoName,
    );
    const baseBranch = metaRepo?.baseBranch ?? detectBaseBranch(repo.worktreePath);
    const changes = getRepoChanges(workspace, repo.repoPath, baseBranch);

    const orgName = repo.repoPath.split("/").slice(0, -1).join("_") || "local";
    const reviewFileName = `REVIEW-${orgName}_${repo.repoName}.md`;
    const verifyFileName = `VERIFY-${orgName}_${repo.repoName}.md`;
    reviewFileNames.push(reviewFileName);
    verifyFileNames.push(verifyFileName);

    // Code reviewer
    reviewChildren.push({
      label: `review-${repo.repoName}`,
      prompt: buildCodeReviewerPrompt({
        workspaceName: workspace,
        repoPath: repo.repoPath,
        repoName: repo.repoName,
        baseBranch,
        reviewTimestamp,
        readmeContent,
        worktreePath: repo.worktreePath,
        repoChanges: `Branch: ${changes.currentBranch}\n\nChanged files:\n${changes.changedFiles}\n\nDiff stat:\n${changes.diffStat}\n\nCommit log:\n${changes.commitLog}`,
        reviewFilePath: path.join(reviewDir, reviewFileName),
      }),
      options: { cwd: repo.worktreePath },
    });

    // TODO verifier
    const todoFile = Bun.file(path.join(wsPath, `TODO-${repo.repoName}.md`));
    const todoContent = (await todoFile.exists())
      ? await todoFile.text()
      : "";

    reviewChildren.push({
      label: `verify-${repo.repoName}`,
      prompt: buildTodoVerifierPrompt({
        workspaceName: workspace,
        repoPath: repo.repoPath,
        repoName: repo.repoName,
        baseBranch,
        reviewTimestamp,
        todoContent,
        worktreePath: repo.worktreePath,
        verifyFilePath: path.join(reviewDir, verifyFileName),
      }),
      options: { cwd: repo.worktreePath },
    });
  }

  const phases: PipelinePhase[] = [
    // Phase 1: Run code reviews and TODO verifiers in parallel
    {
      kind: "group",
      children: reviewChildren,
    },
    // Phase 2: Collect results into summary
    {
      kind: "function",
      label: "Collect review results",
      fn: async (ctx) => {
        // List actual review/verify files that were created
        const files = fs.existsSync(reviewDir) ? fs.readdirSync(reviewDir) : [];
        const actualReviewFiles = files.filter((f) => f.startsWith("REVIEW-"));
        const actualVerifyFiles = files.filter((f) => f.startsWith("VERIFY-"));

        const prompt = buildCollectorPrompt({
          workspaceName: workspace,
          reviewTimestamp,
          reviewDir,
          reviewFiles: actualReviewFiles.map((f) => path.join(reviewDir, f)),
          verifyFiles: actualVerifyFiles.map((f) => path.join(reviewDir, f)),
        });

        return ctx.runChild("Collect reviews", prompt, { cwd: wsPath });
      },
    },
  ];

  const operation = startOperationPipeline("review", workspace, phases);
  return NextResponse.json(operation);
}
