---
name: workspace-add-repo
description: Add a repository to a workspace (clones if needed, creates worktree)
---

# workspace-add-repo

## Overview

This skill adds a repository to an existing workspace. It handles:
1. Cloning or updating the repository
2. Creating a git worktree in the workspace
3. Updating README.md with the new repository entry

**Use case:** When you need to add a new repository to a workspace that was already initialized with `/workspace-init`.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/README.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

## Steps

### 1. Validate Input

**Required parameters:**
- Workspace name (e.g., `feature-user-auth-20260131`)
- Repository path in org/repo format (e.g., `github.com/org/repo`)

**Optional parameters:**
- Base branch override (auto-detected from remote by default)
- Alias for multiple worktrees from same repo (e.g., `github.com/org/repo:dev`)

If workspace or repository is **not specified**, abort with message:
> Please specify a workspace and repository. Example: `/workspace-add-repo feature-user-auth-20260131 github.com/org/repo`

### 2. Validate Workspace Exists

Check that the workspace directory exists:
- Path: `workspace/{workspace-name}/`
- Must contain `README.md`

If workspace does not exist, abort with message:
> Workspace not found: `{workspace-name}`. Use `/workspace-init` to create a new workspace first.

### 3. Run Repository Setup Script

Execute the repository setup script:

```bash
./.claude/scripts/setup-repository.sh <workspace-name> <org/repo-path>
```

**Examples:**

```bash
# Basic usage
./.claude/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo

# Override base branch
BASE_BRANCH=develop ./.claude/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo

# With alias (for multiple worktrees from same repo)
./.claude/scripts/setup-repository.sh feature-user-auth-20260131 github.com/org/repo:dev
```

### 4. Update README.md Repositories Section

After the repository is added, update the `## Repositories` section in README.md to include the new repository:

```markdown
## Repositories

- **existing-repo**: `github.com/org/existing-repo` (base: `main`)
- **new-repo**: `github.com/org/new-repo` (base: `main`)  ← Add this
```

### 5. Report Results

Summarize the results to the user:
- Repository added with worktree path and branch name
- README.md updated

## Example Usage

### Basic: Add a single repository

```
User: /workspace-add-repo feature-user-auth-20260131 github.com/org/api
Assistant:
  1. [Validates workspace exists]
  2. [Runs setup-repository.sh] → Creates worktree
  3. [Updates README.md Repositories section]
  4. Done!
```

### With base branch override

```
User: /workspace-add-repo feature-user-auth-20260131 github.com/org/api with base branch develop
Assistant:
  1. [Validates workspace exists]
  2. [Runs BASE_BRANCH=develop setup-repository.sh]
  3. [Updates README.md]
  4. Done!
```

### With alias (multiple worktrees from same repo)

```
User: /workspace-add-repo feature-config-20260201 github.com/org/infra:prod
Assistant:
  1. [Validates workspace exists]
  2. [Runs setup-repository.sh with alias] → Creates worktree at github.com/org/infra___prod/
  3. [Updates README.md with alias entry]
  4. Done!
```

## Notes

- The script `.claude/scripts/setup-repository.sh` is shared with `/workspace-init`
- Base branch is auto-detected from remote default unless explicitly specified
- Alias syntax: Use `repo:alias` to create multiple worktrees from the same repository
- To create TODO items for the new repository, use `/workspace-update-todo` after adding
