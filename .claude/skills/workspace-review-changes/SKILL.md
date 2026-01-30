---
name: workspace-review-changes
description: Review code changes across all repositories in a workspace
---

# workspace-review-changes

## Overview

This skill reviews code changes across all repositories in a workspace by delegating to the `workspace-repo-review-changes` agent for each repository. It collects all review results and provides a comprehensive summary.

## Steps

### 1. Workspace

**Required**: User must specify the workspace.

- If workspace is **not specified**, abort with message:
  > Please specify a workspace. Example: `/workspace-review-changes workspace/feature-user-auth-20260116`
- Workspace format: `workspace/{workspace-name}` or just `{workspace-name}`

### 2. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

For each repository:
1. Extract the repository name
2. Determine the base branch (from README.md)
3. Prepare parameters for the review agent

### 3. Create Reviews Directory

Run the script to create a timestamped review directory. **Important**: Capture the output path and reuse it for all parallel agents to ensure consistency.

```bash
REVIEW_DIR=$(.claude/skills/workspace-review-changes/scripts/prepare-review-dir.sh {workspace-name})
```

The script outputs the created directory path (e.g., `workspace/{workspace-name}/reviews/20260116-103045`).

### 4. Delegate to Review Agent for Each Repository

For each repository in the workspace, use the Task tool to launch the `workspace-repo-review-changes` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-review-changes
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

After all review agents complete, use the Task tool to launch the `workspace-collect-reviews` agent:

```yaml
Task tool:
  subagent_type: workspace-collect-reviews
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

### 6. Commit Workspace Snapshot

After all reviews complete, commit the workspace changes (including review results):

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name}
```

### 7. Present Summary to User

Display a concise summary to the user.

Refer to `.claude/skills/workspace-review-changes/templates/user-summary.md` for the format and fill in the placeholders with the collected results.

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

## Next Steps - Ask User to Proceed

After review is complete, **always ask the user** whether to proceed with the next step using AskUserQuestion:

```yaml
AskUserQuestion tool:
  questions:
    - question: "Code review complete. Would you like to create pull requests for the changes?"
      header: "Next Step"
      multiSelect: false
      options:
        - label: "Create PRs (draft)"
          description: "Run /workspace-create-pr to create draft pull requests"
        - label: "Create PRs (ready for review)"
          description: "Create non-draft pull requests immediately"
        - label: "Fix issues first"
          description: "I need to address the review findings before creating PRs"
```

Based on the user's selection:
- "Create PRs (draft)" → Invoke the `/workspace-create-pr` skill using the Skill tool (default draft mode)
- "Create PRs (ready for review)" → Invoke the `/workspace-create-pr` skill with non-draft option
- "Fix issues first" → End the workflow so user can address review findings

## Notes

- The skill delegates actual review work to the `workspace-repo-review-changes` agent
- Each repository is reviewed independently and in parallel
- Review results are timestamped to avoid overwriting previous reviews
- The summary provides a high-level view while individual reports contain detailed findings
- Launch all repository review agents in parallel for faster execution
- If a repository review fails, continue with others and report which failed
- Always replace slashes (`/`) in repository paths with underscores (`_`) when generating filenames
