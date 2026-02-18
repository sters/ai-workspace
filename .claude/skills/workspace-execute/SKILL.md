---
name: workspace-execute
description: "Continue working on an existing workspace by executing TODO items. Implements code, runs tests, makes commits. Use when the user wants to resume or continue work on a previously initialized workspace, or after /workspace-init completes."
---

# workspace-execute

## Overview

This skill executes work in an initialized workspace. It detects the task type and routes accordingly:
- **Research/Investigation tasks**: Delegates to the `workspace-researcher` agent for cross-repository investigation
- **All other tasks** (feature, bugfix, etc.): Delegates to the `workspace-repo-todo-executor` agent per repository

**Prerequisites:** The workspace must be initialized first using `/workspace-init`.

**Paths:** Use relative paths from project root for all workspace file operations (see CLAUDE.md for details).

## Arguments

This skill receives `$ARGUMENTS` from the caller. Parse to extract:
- Workspace name (required): `workspace/{workspace-name}` or just `{workspace-name}`
- Example: `workspace/feature-user-auth-20260116` or `feature-user-auth-20260116`

If `$ARGUMENTS` is empty, abort with message:
> Please specify a workspace. Example: `/workspace-execute workspace/feature-user-auth-20260116`

## Steps

### 1. Detect Task Type and Route

Read the workspace README.md to determine the task type:

```
workspace/{workspace-name}/README.md
```

Look for `**Task Type**` in the README. Based on the value:

- **`research`**, **`investigation`**, **`documentation`**, or **`design-doc`** → **Route A** (Research flow)
- **All other types** (feature, bugfix, etc.) → **Route B** (Standard TODO execution flow)

**Guideline**: Route A is for tasks whose primary output is a **document** (report, design doc, analysis) based on cross-repository exploration. Route B is for tasks that **modify code** in repositories. If the task type is ambiguous, check the README objective — if it describes producing a document rather than changing code, use Route A.

---

#### Route A: Research Flow

For research/investigation tasks, launch a single `workspace-researcher` agent:

```yaml
Task tool:
  subagent_type: workspace-researcher
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
```

**What the agent does (defined in agent, not by prompt):**

- Reads README.md to understand research objectives
- Discovers all repositories in the workspace
- Investigates each repository and cross-repository concerns
- Writes findings to `artifacts/research-report.md`
- Appends a summary to README.md

After launching the researcher agent, **skip directly to Step 4** (Report Agent Launch).

---

#### Route B: Standard TODO Execution Flow

For feature, bugfix, and other implementation tasks, continue with Step 3 below.

### 2. Find Repositories (Route B only)

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

For each repository, extract:
- Repository path (e.g., `github.com/sters/ai-workspace`)
- Repository name (e.g., `ai-workspace`)

### 3. Launch Executor Agents (Route B only)

For each repository in the workspace, use the Task tool to launch the `workspace-repo-todo-executor` agent in background:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-executor
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {org/repo-path}
```

**What the agent does (defined in agent, not by prompt):**

- Reads README.md and `TODO-{repository-name}.md` to understand the task
- Executes TODO items sequentially
- Updates the TODO file as items are completed
- Runs tests and linters
- Makes commits with descriptive messages
- Reports completion summary

**Important**: Launch all agents in parallel if there are multiple repositories.

### 4. Report Agent Launch

Report the launched agents to the user immediately. **Do NOT wait for agents to complete.**

**For Route A (Research):**
- Confirm the researcher agent was launched
- Workspace name

**For Route B (Standard):**
- Number of executor agents launched
- Repository names

**Blocker handling**: If an executor agent encounters a blocker, it records the item as `- [!]` (blocked) in the TODO file. The user can check progress with `/workspace-show-status` and resolve blockers with `/workspace-update-todo`.

## Example Usage

### Example 1: Execute Feature Workspace (Route B)

```
User: Execute the tasks in my workspace
Assistant: Let me identify the workspace and execute the TODO items...
[Reads README.md → Task Type: feature → Route B]
[Identifies repositories, launches 2 executor agents in background]
Launched 2 executor agents in background. Use /workspace-show-status to monitor progress.
```

### Example 2: Execute Research Workspace (Route A)

```
User: Execute workspace/research-auth-flow-20260116
Assistant: I'll execute the research in workspace/research-auth-flow-20260116...
[Reads README.md → Task Type: research → Route A]
[Launches workspace-researcher agent in background]
Launched researcher agent in background. Use /workspace-show-status to monitor progress.
```

## After Completion

After launching agents, report directly to the user:
- Number of agents launched and repository names
- Suggest `/workspace-show-status {workspace-name}` to monitor progress
- Do NOT invoke other skills automatically — let the user decide next steps

## Notes

- The skill detects task type from README.md and routes to the appropriate agent
- **Research tasks** (Route A): A single `workspace-researcher` agent handles all repositories
- **Standard tasks** (Route B): Each repository is processed by its own `workspace-repo-todo-executor` agent instance
- Agents handle their work autonomously (test execution, linting, commits for Route B; exploration and reporting for Route A)
- **Non-blocking**: This skill returns immediately after launching agents. It does NOT wait for agents to complete. Use `/workspace-show-status` to monitor progress.
- **Blockers**: If an executor encounters an issue it cannot resolve, it marks the TODO item with `- [!]` (blocked). Use `/workspace-show-status` to see blocked items and `/workspace-update-todo` to resolve them.
