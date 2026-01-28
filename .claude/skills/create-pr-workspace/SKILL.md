---
name: create-pr-workspace
description: Create pull requests for all repositories in a workspace
---

# create-pr-workspace

## Overview

This skill creates pull requests for all repositories in a workspace by delegating to the `create-pr` agent for each repository.

**Default behavior**: PRs are created as **draft** unless explicitly requested otherwise.

## Prerequisites (Recommended)

Before creating PRs, it's recommended to run a code review:

```
/review-workspace-changes
```

## Steps

### 1. Identify the Workspace

- If the user specifies a workspace directory, use that
- If not specified, ask the user which workspace
- List available workspaces if needed:

```bash
ls -d workspace/*/
```

### 2. Identify Repositories

Find all repository worktrees in the workspace:

```bash
ls -d workspace/{workspace-name}/*/
```

### 3. Delegate to create-pr Agent for Each Repository

For each repository in the workspace, use the Task tool to launch the `create-pr` agent:

```yaml
Task tool:
  subagent_type: create-pr
  prompt: |
    Create a pull request for the repository.

    Workspace Name: {workspace-name}
    Repository Worktree Path: workspace/{workspace-name}/{repo-directory}
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
[Identifies repositories, launches create-pr agents]
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
