---
name: review-workspace-changes
description: Review code changes across all repositories in a workspace
---

# review-workspace-changes

## Overview

This skill reviews code changes across all repositories in a workspace by delegating to the `review-workspace-repo-changes` agent for each repository. It collects all review results and provides a comprehensive summary.

## Steps

### 1. Identify the Workspace

First, determine which workspace to review:

- If the user specifies a workspace directory (e.g., `workspace/feature-user-auth-20260116`), use that
- If not specified, ask the user which workspace they want to review
- List available workspaces if needed:

```bash
ls -d workspace/*/
```

### 2. Identify Repositories to Review

Find all repository worktrees in the workspace:

```bash
# List all directories in the workspace (excluding README and TODO files)
ls -d workspace/{workspace-name}/*/
```

Common patterns:
- Repository directories are typically named: `{repo-name}` or `{org}_{repo-name}`
- Each repository should have a corresponding `TODO-{repo-name}.md` file
- Repositories are git worktrees

For each repository directory:
1. Extract the repository name
2. Determine the base branch (from README.md or ask user)
3. Prepare parameters for the review agent

### 3. Create Reviews Directory

Run the script to create a timestamped review directory. **Important**: Capture the output path and reuse it for all parallel agents to ensure consistency.

```bash
REVIEW_DIR=$(.claude/skills/review-workspace-changes/scripts/prepare-review-dir.sh {workspace-name})
```

The script outputs the created directory path (e.g., `workspace/{workspace-name}/reviews/20260116-103045`).

### 4. Delegate to Review Agent for Each Repository

For each repository in the workspace, use the Task tool to launch the `review-workspace-repo-changes` agent:

```yaml
Task tool:
  subagent_type: review-workspace-repo-changes
  run_in_background: true
  prompt: |
    Review changes for repository in workspace.

    Task Name: {task-name}
    Workspace Directory: workspace/{workspace-name}
    Repository Path: {org/repo-path}
    Repository Name: {repo-name}
    Repository Worktree Path: workspace/{workspace-name}/{repo-directory}
    Base Branch: {base-branch}

    Save review to: workspace/{workspace-name}/reviews/{timestamp}/{org}_{repo-name}.md
```

**Example**: For repository `github.com/sters/complex-ai-workspace`, the filename would be `github.com_sters_complex-ai-workspace.md` (slashes replaced with underscores).

**Important**: Launch review agents in parallel if there are multiple repositories to review efficiently. Pass the same `{timestamp}` value to all agents.

### 5. Collect Review Results and Create Summary Report

After all review agents complete, use the Task tool to launch the `collect-review-results` agent:

```yaml
Task tool:
  subagent_type: collect-review-results
  run_in_background: true
  prompt: |
    Collect review results from the review directory.

    Review Directory: {review-dir}
    Workspace Name: {workspace-name}
```

The agent will:
1. Read all review files and extract statistics
2. Create `SUMMARY.md` in the review directory
3. Return aggregated results for presenting to the user

### 6. Present Summary to User

Display a concise summary to the user.

Refer to `.claude/skills/review-workspace-changes/templates/user-summary.md` for the format and fill in the placeholders with the collected results.

## Example Usage

### Example 1: Review Current Workspace

```
User: Review the changes in my current workspace
Assistant: Let me review the workspace. First, I'll identify which workspace you're working in...
[Identifies repositories, launches review agents]
[After completion]
Review complete! I found 2 critical issues and 5 warnings across 3 repositories.
Summary: workspace/feature-user-auth-20260116/reviews/20260116-103045/SUMMARY.md
```

### Example 2: Review Specific Workspace

```
User: Review workspace/feature-login-fix-20260115
Assistant: I'll review the workspace/feature-login-fix-20260115 workspace...
[Identifies 2 repositories, launches agents in parallel]
[After completion]
Review complete! All changes look good with 0 critical issues and 3 suggestions.
```

## Notes

- The skill delegates actual review work to the `review-workspace-repo-changes` agent
- Each repository is reviewed independently and in parallel
- Review results are timestamped to avoid overwriting previous reviews
- The summary provides a high-level view while individual reports contain detailed findings
- Launch all repository review agents in parallel for faster execution
- If a repository review fails, continue with others and report which failed
- Always replace slashes (`/`) in repository paths with underscores (`_`) when generating filenames
