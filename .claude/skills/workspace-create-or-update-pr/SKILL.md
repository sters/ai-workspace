---
name: workspace-create-or-update-pr
description: Create or update pull requests for all repositories (draft by default)
---

# workspace-create-or-update-pr

## Overview

This skill creates or updates pull requests for all repositories in a workspace by delegating to the `workspace-repo-create-or-update-pr` agent for each repository.

- **New branch**: Creates a new PR (draft by default)
- **Existing PR**: Updates the PR title and body with latest changes

**Default behavior**: PRs are created as **draft** unless explicitly requested otherwise.

**Paths:** Use relative paths from project root for all workspace file operations (see CLAUDE.md for details).

## Arguments

This skill receives `$ARGUMENTS` from the caller. Parse to extract:
- Workspace name (required): `workspace/{workspace-name}` or just `{workspace-name}`
- Draft mode (optional): `--no-draft` to create non-draft PRs (default: draft)
- Example: `workspace/feature-user-auth-20260116`
- Example: `feature-user-auth-20260116 --no-draft`

If workspace is not specified in `$ARGUMENTS`, abort with message:
> Please specify a workspace. Example: `/workspace-create-or-update-pr workspace/feature-user-auth-20260116`

## Steps

### 1. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

### 2. Launch PR Agents

For each repository in the workspace, use the Task tool to launch the `workspace-repo-create-or-update-pr` agent in background:

```yaml
Task tool:
  subagent_type: workspace-repo-create-or-update-pr
  model: sonnet
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {org/repo-path}
    Base Branch: {base-branch}
    Draft: {true|false}
```

**What the agent does (defined in agent, not by prompt):**
- Gathers all information in parallel (PR template, README, git diff)
- Composes PR title and body
- Creates or updates the pull request

**Important**: Launch agents in parallel if there are multiple repositories.

**Do NOT wait for agents to complete.** Proceed immediately to Step 3.

### 3. Report Agents Launched

Report the launched agents to the user immediately.

- Number of PR agents launched
- Repository names
- Draft mode status

## Example Usage

### Example 1: Create PRs for Current Workspace

```
User: Create PRs for my workspace
Assistant: Let me identify the workspace and create PRs...
[Identifies 2 repositories, launches 2 PR agents in background]
Launched 2 PR agents in background (draft mode).
PR URLs will be available when agents complete.
```

### Example 2: Update Existing PR

```
User: Update the PR with my latest changes
Assistant: I'll update the existing PR...
[Launches 1 PR agent in background]
Launched 1 PR agent in background.
PR URL will be available when agent completes.
```

### Example 3: Create Non-Draft PR

```
User: Create a PR for workspace/feature-user-auth-20260116, not as draft
Assistant: I'll create a non-draft PR...
[Launches 1 PR agent in background with draft=false]
Launched 1 PR agent in background (non-draft mode).
PR URL will be available when agent completes.
```

## After Launching

After launching PR agents, report directly to the user immediately (**do NOT wait for agents to complete**):
- Number of agents launched and repository names
- Draft mode status
- Note that PR URLs will be available when agents complete
- Suggest `/workspace-show-status {workspace-name}` to monitor progress

## After All Agents Complete

When all background agents have completed (confirmed via `<task-notification>`), use `AskUserQuestion` to let the user choose the next action:

```yaml
AskUserQuestion:
  question: "All PR agents have completed. What would you like to do next?"
  header: "Next step"
  options:
    - label: "/workspace-show-status (Recommended)"
      description: "Check PR URLs and status"
    - label: "Done"
      description: "No further action needed"
```

After the user selects an option, invoke the corresponding skill with the workspace name as argument (if applicable). Do NOT invoke other skills automatically before asking.

## Notes

- PRs are created as draft by default for safety
- If a PR already exists for the branch, it will be updated instead of creating a new one
- The agent respects repository PR templates if they exist
- PR body is temporarily stored in `workspace/{name}/tmp/` during creation
- **Non-blocking**: This skill returns immediately after launching agents. It does NOT wait for agents to complete. PR URLs will be reported via agent completion notifications.
