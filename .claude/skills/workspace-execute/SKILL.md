---
name: workspace-execute
description: Execute TODO items (implements code, runs tests, makes commits)
---

# workspace-execute

## Overview

This skill executes work in an initialized workspace by delegating to the `workspace-repo-todo-executor` agent for each repository. It works through TODO items, runs tests/linters, and commits changes.

**Prerequisites:** The workspace must be initialized first using `/workspace-init`.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/README.md`
- `workspace/{workspace-name}/TODO-{repository-name}.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-execute workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

For each repository, extract:
- Repository path (e.g., `github.com/sters/ai-workspace`)
- Repository name (e.g., `ai-workspace`)

### 3. Launch Executor Agents

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

### 4. Monitor and Handle Blockers (Per-Agent)

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

After **all** repositories are complete (including any re-runs after blocker resolution):

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name}
```

### 6. Report Final Results

Report the execution summary to the user:

- Completed TODO items count (per repository and total)
- Remaining TODO items (if any)
- Skipped items (if any blockers were skipped)
- Test/lint status
- Commits made

## Example Usage

### Example 1: Execute Current Workspace

```
User: Execute the tasks in my workspace
Assistant: Let me identify the workspace and execute the TODO items...
[Identifies repositories, launches executor agents]
[After completion]
Execution complete! Completed 8 TODO items across 2 repositories.
```

### Example 2: Execute Specific Workspace

```
User: Execute workspace/feature-user-auth-20260116
Assistant: I'll execute the tasks in workspace/feature-user-auth-20260116...
[Launches executor agent for each repository]
[After completion]
All TODO items completed. Tests passing, no lint errors.
```

## Next Steps - Ask User to Proceed

After all execution is complete (Step 6), **always ask the user** whether to proceed with the next step using AskUserQuestion.

**Note**: Blockers are handled inline during Step 4, so by this point all blockers have been resolved or skipped.

```yaml
AskUserQuestion tool:
  questions:
    - question: "Task execution complete. Would you like to review the code changes before creating/updating a PR?"
      header: "Next Step"
      multiSelect: false
      options:
        - label: "Review changes (Recommended)"
          description: "Run /workspace-review-changes to check for issues before PR"
        - label: "Skip review, create/update PR"
          description: "Proceed directly to /workspace-create-or-update-pr (creates new PR or updates existing)"
        - label: "Done for now"
          description: "I'll continue manually later"
```

Based on the user's selection:
- "Review changes" → Invoke the `/workspace-review-changes` skill using the Skill tool
- "Skip review, create/update PR" → Invoke the `/workspace-create-or-update-pr` skill using the Skill tool
- "Done for now" → End the workflow

**Important**: Always suggest `/workspace-create-or-update-pr` instead of manual `git push`. The skill handles both creating new PRs and updating existing PRs automatically.

## Notes

- The skill delegates actual work to the `workspace-repo-todo-executor` agent
- Each repository is processed by its own agent instance
- The agent handles test execution, linting, and commits autonomously
