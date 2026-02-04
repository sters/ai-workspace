---
name: workspace-create-pr
description: Create pull requests for all repositories in a workspace
---

# workspace-create-pr

## Overview

This skill creates pull requests for all repositories in a workspace by delegating to the `workspace-repo-create-pr` agent for each repository.

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
  > Please specify a workspace. Example: `/workspace-create-pr workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

### 3. Delegate to workspace-repo-create-pr Agent for Each Repository

For each repository in the workspace, use the Task tool to launch the `workspace-repo-create-pr` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-create-pr
  run_in_background: true
  prompt: |
    Create a pull request for the repository.

    Workspace Name: {workspace-name}
    Repository Path: {org/repo-path}
    Repository Name: {repo-name}
    Base Branch: {base-branch}
    Draft: true (unless user requested non-draft)
```

**Important**: Launch agents in parallel if there are multiple repositories.

### 4. Report Results

After all agents complete, report the created PR URLs to the user.

## Example Usage

### Example 1: Create PRs for Current Workspace

```
User: Create PRs for my workspace
Assistant: Let me identify the workspace and create PRs...
[Identifies repositories, launches workspace-repo-create-pr agents]
[After completion]
PRs created:
- https://github.com/org/repo1/pull/123 (draft)
- https://github.com/org/repo2/pull/456 (draft)
```

### Example 2: Create Non-Draft PR

```
User: Create a PR for workspace/feature-user-auth-20260116, not as draft
Assistant: I'll create a non-draft PR...
[Launches create-pr agent with draft=false]
PR created: https://github.com/org/repo/pull/789
```

## Notes

- PRs are created as draft by default for safety
- The agent respects repository PR templates if they exist
- PR body is temporarily stored in `workspace/{name}/tmp/` during creation
