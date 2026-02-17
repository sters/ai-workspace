---
name: workspace-execute
description: "Continue working on an existing workspace by executing TODO items. Implements code, runs tests, makes commits. Use when the user wants to resume or continue work on a previously initialized workspace, or after /workspace-init completes."
context: fork
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

After the researcher agent completes, **skip directly to Step 6** (Commit Workspace Snapshot).

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

### 4. Monitor and Handle Blockers (Route B only)

**Do not wait for all agents to complete.** Instead, monitor each agent and handle blockers as soon as they are reported.

For each agent that completes:

1. **Parse the response** - The executor agent returns:
   ```
   DONE: Completed {n} TODO items for {repository-name}
   OUTPUT: workspace/{workspace-name}/TODO-{repository-name}.md
   STATS: completed={n}, remaining={m}, blocked={b}, commits={c}, tests={pass/fail}, lint={pass/fail}
   BLOCKED: {brief description of blocker(s)} (only if blocked > 0)
   ```

2. **If `blocked > 0`**, immediately delegate to the `workspace-repo-blocker-planner` agent:
   ```yaml
   Task tool:
     subagent_type: workspace-repo-blocker-planner
     prompt: |
       Workspace: {workspace-name}
       Repository: {repository-name}
   ```

3. **Present blocker options to user**:
   ```yaml
   AskUserQuestion tool:
     questions:
       - question: "[{repository-name}] {blocker title} - How would you like to proceed?"
         header: "Blocker"
         multiSelect: false
         options:
           - label: "{Option 1 from agent analysis}"
             description: "{Trade-off or impact}"
           - label: "{Option 2 from agent analysis}"
             description: "{Trade-off or impact}"
           - label: "Skip this item"
             description: "Defer to a later PR"
   ```

4. **Based on user selection**:
   - **FIX/WORKAROUND** → Update TODO file with chosen approach, re-launch executor for that repository
   - **SKIP** → Mark item as skipped in TODO file, continue monitoring other agents

5. **If no blockers**, note completion and continue monitoring remaining agents.

**Parallel handling**: While waiting for user input on one blocker, other agents may complete. Queue their results and process blockers sequentially to avoid overwhelming the user.

### 5. Commit Workspace Snapshot

After execution is complete (Route A: researcher done, Route B: all repositories done including re-runs):

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name}
```

### 6. Report Final Results

Report the execution summary to the user.

**For Route A (Research):**
- Research report location
- Number of repositories analyzed
- Key findings summary (read from `artifacts/research-report.md` if needed)

**For Route B (Standard):**
- Completed TODO items count (per repository and total)
- Remaining TODO items (if any)
- Skipped items (if any blockers were skipped)
- Test/lint status
- Commits made

## Example Usage

### Example 1: Execute Feature Workspace (Route B)

```
User: Execute the tasks in my workspace
Assistant: Let me identify the workspace and execute the TODO items...
[Reads README.md → Task Type: feature → Route B]
[Identifies repositories, launches executor agents]
[After completion]
Execution complete! Completed 8 TODO items across 2 repositories.
```

### Example 2: Execute Research Workspace (Route A)

```
User: Execute workspace/research-auth-flow-20260116
Assistant: I'll execute the research in workspace/research-auth-flow-20260116...
[Reads README.md → Task Type: research → Route A]
[Launches workspace-researcher agent]
[After completion]
Research complete! Report saved to artifacts/research-report.md.
3 repositories analyzed, 12 findings documented.
```

## Structured Return (CRITICAL)

After completing all steps, return a structured completion message. **Do NOT invoke other skills or use AskUserQuestion for next steps.** The main context handles routing.

### For Route B (Standard tasks)

```
SKILL_COMPLETE: workspace-execute
WORKSPACE: {workspace-name}
ROUTE: B
REPOS: {repo1} (completed={n}, remaining={m}, blocked={b}), {repo2} (...)
SUMMARY: Completed {total-completed} TODO items across {n} repositories. {total-remaining} remaining, {total-blocked} blocked.
NEXT_ACTION: workspace-review-changes {workspace-name}
```

### For Route A (Research tasks)

```
SKILL_COMPLETE: workspace-execute
WORKSPACE: {workspace-name}
ROUTE: A
SUMMARY: Research complete. Report at artifacts/research-report.md. {n} repositories analyzed.
NEXT_ACTION: none
```

## Notes

- The skill detects task type from README.md and routes to the appropriate agent
- **Research tasks** (Route A): A single `workspace-researcher` agent handles all repositories
- **Standard tasks** (Route B): Each repository is processed by its own `workspace-repo-todo-executor` agent instance
- Agents handle their work autonomously (test execution, linting, commits for Route B; exploration and reporting for Route A)
