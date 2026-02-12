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

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/tmp/pr-body-{repo-name}.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-create-or-update-pr workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

### 3. Delegate to workspace-repo-create-or-update-pr Agent for Each Repository

For each repository in the workspace, use the Task tool to launch the `workspace-repo-create-or-update-pr` agent:

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

### 4. Report Results

After all agents complete, report the created/updated PR URLs to the user.

## Example Usage

### Example 1: Create PRs for Current Workspace

```
User: Create PRs for my workspace
Assistant: Let me identify the workspace and create PRs...
[Identifies repositories, launches workspace-repo-create-or-update-pr agents]
[After completion]
PRs created:
- https://github.com/org/repo1/pull/123 (draft)
- https://github.com/org/repo2/pull/456 (draft)
```

### Example 2: Update Existing PR

```
User: Update the PR with my latest changes
Assistant: I'll update the existing PR...
[Launches workspace-repo-create-or-update-pr agent]
[After completion]
PR updated: https://github.com/org/repo/pull/123
```

### Example 3: Create Non-Draft PR

```
User: Create a PR for workspace/feature-user-auth-20260116, not as draft
Assistant: I'll create a non-draft PR...
[Launches create-pr agent with draft=false]
PR created: https://github.com/org/repo/pull/789
```

## Notes

- PRs are created as draft by default for safety
- If a PR already exists for the branch, it will be updated instead of creating a new one
- The agent respects repository PR templates if they exist
- PR body is temporarily stored in `workspace/{name}/tmp/` during creation
