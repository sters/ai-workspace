import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WORKSPACE_DIR } from "@/lib/config";
import { startOperationPipeline } from "@/lib/process-manager";
import { parseReadmeMeta } from "@/lib/readme-parser";
import {
  buildAnalysisPrompt,
  parseAnalysisResult,
  setupWorkspace,
  setupRepository,
  commitWorkspaceSnapshot,
  type SetupRepositoryResult,
} from "@/lib/workspace-ops";
import {
  buildInitReadmePrompt,
  buildPlannerPrompt,
  buildCoordinatorPrompt,
  buildReviewerPrompt,
} from "@/lib/prompts";
import type { PipelinePhase } from "@/lib/process-manager";

export async function POST(request: Request) {
  const body = await request.json();
  const { description } = body as { description: string };
  if (!description) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  // Temp file for analysis result (unique per request)
  const analysisPath = path.join(os.tmpdir(), `ai-ws-analysis-${Date.now()}.json`);

  // Shared mutable state across pipeline phases
  let wsName = "";
  let wsPath = "";
  const repoResults: SetupRepositoryResult[] = [];

  const phases: PipelinePhase[] = [
    // Phase A: Claude analyzes the task description (visible in FE logs)
    {
      kind: "function",
      label: "Analyze task description",
      fn: async (ctx) => {
        const prompt = buildAnalysisPrompt(description, analysisPath);
        return ctx.runChild("Analyze task", prompt);
      },
    },
    // Phase B: Read analysis result, create workspace, setup repos
    {
      kind: "function",
      label: "Setup workspace",
      fn: async (ctx) => {
        const analysis = parseAnalysisResult(analysisPath, description);
        // Clean up temp file
        try { fs.unlinkSync(analysisPath); } catch { /* ignore */ }

        ctx.emitStatus(
          `Detected: type=${analysis.taskType}, slug=${analysis.slug}` +
            (analysis.ticketId ? `, ticket=${analysis.ticketId}` : "") +
            (analysis.repositories.length > 0
              ? `, repos=[${analysis.repositories.join(", ")}]`
              : ""),
        );

        ctx.emitStatus("Creating workspace directory...");
        const result = setupWorkspace(
          analysis.taskType,
          description,
          analysis.ticketId || undefined,
          analysis.slug,
        );
        wsName = result.workspaceName;
        wsPath = result.workspacePath;
        ctx.setWorkspace(wsName);
        ctx.emitStatus(`Workspace created: ${wsName}`);

        if (analysis.repositories.length > 0) {
          for (const repoPath of analysis.repositories) {
            ctx.emitStatus(`Setting up repository: ${repoPath}`);
            try {
              const repoResult = setupRepository(wsName, repoPath);
              repoResults.push(repoResult);
              ctx.emitStatus(`Repository ready: ${repoResult.repoName} (branch: ${repoResult.branchName})`);
            } catch (err) {
              ctx.emitResult(`Failed to setup repository ${repoPath}: ${err}`);
              return false;
            }
          }
        }

        const repoSummary = repoResults.length > 0
          ? `\nRepositories: ${repoResults.map((r) => `${r.repoName} (${r.branchName})`).join(", ")}`
          : "";
        ctx.emitResult(`Workspace **${wsName}** created.${repoSummary}`);
        return true;
      },
    },
    // Phase C: Claude fills in README (may ask user for clarification)
    {
      kind: "function",
      label: "Fill in README",
      fn: async (ctx) => {
        const readmeContent = fs.readFileSync(path.join(wsPath, "README.md"), "utf-8");
        const prompt = buildInitReadmePrompt({
          workspaceName: wsName,
          workspacePath: wsPath,
          readmeContent,
          description,
          repos: repoResults.map((r) => ({
            repoPath: r.repoPath,
            repoName: r.repoName,
            baseBranch: r.baseBranch,
            branchName: r.branchName,
          })),
        });

        return ctx.runChild("Fill README", prompt, { cwd: wsPath });
      },
    },
    // Phase D: Detect task type and setup any additional repos from README
    {
      kind: "function",
      label: "Prepare for planning",
      fn: async (ctx) => {
        const readmeContent = fs.readFileSync(path.join(wsPath, "README.md"), "utf-8");
        const meta = parseReadmeMeta(readmeContent);

        // If repos were added to README but not set up yet, set them up now
        for (const metaRepo of meta.repositories) {
          const already = repoResults.find(
            (r) => r.repoPath === metaRepo.path || r.repoName === metaRepo.alias,
          );
          if (!already) {
            ctx.emitStatus(`Setting up newly identified repository: ${metaRepo.path}`);
            try {
              const repoResult = setupRepository(wsName, metaRepo.path, metaRepo.baseBranch);
              repoResults.push(repoResult);
            } catch (err) {
              ctx.emitStatus(`Warning: Failed to setup ${metaRepo.path}: ${err}`);
            }
          }
        }

        const isResearch = meta.taskType === "research" || meta.taskType === "investigation";
        if (isResearch) {
          commitWorkspaceSnapshot(wsName, "Setup complete (research task)");
          ctx.emitResult("Research/investigation task — skipping TODO planning.");
          return true;
        }

        if (repoResults.length === 0) {
          commitWorkspaceSnapshot(wsName, "Setup complete (no repos)");
          ctx.emitResult("No repositories configured — skipping TODO planning.");
          return true;
        }

        ctx.emitResult(`Ready to plan: ${repoResults.length} repo(s), task type: ${meta.taskType}`);
        return true;
      },
    },
    // Phase E: Plan TODOs for each repo (parallel)
    {
      kind: "function",
      label: "Plan TODO items",
      fn: async (ctx) => {
        const readmeContent = fs.readFileSync(path.join(wsPath, "README.md"), "utf-8");
        const meta = parseReadmeMeta(readmeContent);

        const isResearch = meta.taskType === "research" || meta.taskType === "investigation";
        if (isResearch || repoResults.length === 0) {
          ctx.emitStatus("Skipping TODO planning");
          return true;
        }

        const children = repoResults.map((repo) => ({
          label: `plan-${repo.repoName}`,
          prompt: buildPlannerPrompt({
            workspaceName: wsName,
            repoPath: repo.repoPath,
            repoName: repo.repoName,
            readmeContent,
            worktreePath: repo.worktreePath,
            taskType: meta.taskType,
          }),
          options: { cwd: wsPath },
        }));

        ctx.emitStatus(`Planning TODOs for ${children.length} repositories`);
        const results = await ctx.runChildGroup(children);
        const allSuccess = results.every(Boolean);
        ctx.emitStatus(
          `Planning complete: ${results.filter(Boolean).length}/${results.length} succeeded`,
        );

        return allSuccess;
      },
    },
    // Phase F: Coordinate TODOs across repos (single, skip for single repo)
    {
      kind: "function",
      label: "Coordinate TODOs",
      fn: async (ctx) => {
        const readmeContent = fs.readFileSync(path.join(wsPath, "README.md"), "utf-8");
        const meta = parseReadmeMeta(readmeContent);
        const isResearch = meta.taskType === "research" || meta.taskType === "investigation";
        if (isResearch || repoResults.length <= 1) {
          ctx.emitStatus("Skipping coordination (single repo or research task)");
          return true;
        }

        const todoFiles = repoResults
          .map((repo) => {
            const todoPath = path.join(wsPath, `TODO-${repo.repoName}.md`);
            if (!fs.existsSync(todoPath)) return null;
            return {
              repoName: repo.repoName,
              content: fs.readFileSync(todoPath, "utf-8"),
            };
          })
          .filter((f): f is { repoName: string; content: string } => f !== null);

        if (todoFiles.length === 0) {
          ctx.emitStatus("No TODO files found, skipping coordination");
          return true;
        }

        const prompt = buildCoordinatorPrompt({
          workspaceName: wsName,
          readmeContent,
          todoFiles,
          workspacePath: wsPath,
        });

        ctx.emitStatus("Coordinating TODOs across repositories");
        return ctx.runChild("Coordinate TODOs", prompt, { cwd: wsPath });
      },
    },
    // Phase G: Review TODOs (parallel, per repo)
    {
      kind: "function",
      label: "Review TODOs",
      fn: async (ctx) => {
        const readmeContent = fs.readFileSync(path.join(wsPath, "README.md"), "utf-8");
        const meta = parseReadmeMeta(readmeContent);
        const isResearch = meta.taskType === "research" || meta.taskType === "investigation";
        if (isResearch || repoResults.length === 0) {
          ctx.emitStatus("Skipping TODO review");
          return true;
        }

        const children = repoResults
          .map((repo) => {
            const todoPath = path.join(wsPath, `TODO-${repo.repoName}.md`);
            if (!fs.existsSync(todoPath)) return null;
            const todoContent = fs.readFileSync(todoPath, "utf-8");

            return {
              label: `review-${repo.repoName}`,
              prompt: buildReviewerPrompt({
                workspaceName: wsName,
                repoName: repo.repoName,
                readmeContent,
                todoContent,
                worktreePath: repo.worktreePath,
              }),
              options: { cwd: wsPath },
            };
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (children.length === 0) {
          ctx.emitStatus("No TODO files to review");
          return true;
        }

        ctx.emitStatus(`Reviewing TODOs for ${children.length} repositories`);
        const results = await ctx.runChildGroup(children);
        const allSuccess = results.every(Boolean);
        ctx.emitStatus(
          `Review complete: ${results.filter(Boolean).length}/${results.length} succeeded`,
        );

        return allSuccess;
      },
    },
    // Phase H: Commit workspace snapshot
    {
      kind: "function",
      label: "Commit snapshot",
      fn: async (ctx) => {
        ctx.emitStatus("Committing workspace snapshot...");
        commitWorkspaceSnapshot(wsName, "Init complete: workspace setup and TODO planning");
        ctx.emitResult(`Workspace **${wsName}** initialization complete.`);
        return true;
      },
    },
  ];

  const operation = startOperationPipeline("init", description, phases);
  return NextResponse.json(operation);
}
