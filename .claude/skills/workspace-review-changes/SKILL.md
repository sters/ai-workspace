---
name: workspace-review-changes
description: Review code changes and generate review reports
---

# workspace-review-changes

## Overview

This skill reviews code changes across all repositories in a workspace by delegating to the `workspace-repo-review-changes` agent for each repository. It collects all review results and provides a comprehensive summary.

## Critical: File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

When accessing workspace files, use paths like:
- `workspace/{workspace-name}/reviews/{timestamp}/*.md`

**DO NOT** use absolute paths (starting with `/`) for workspace files. The permission system requires relative paths from the project root.

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

### 4. Delegate to Review and Verification Agents for Each Repository

For each repository in the workspace, launch **both** agents in parallel:

#### 4a. Code Review Agent

```yaml
Task tool:
  subagent_type: workspace-repo-review-changes
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {org/repo-path}
    Base Branch: {base-branch}
    Review Timestamp: {timestamp}
```

**What the agent does (defined in agent, not by prompt):**
- Compares current branch against remote base branch
- Reviews code for security, performance, and quality issues
- Writes review report to the review directory

#### 4b. TODO Verification Agent

```yaml
Task tool:
  subagent_type: workspace-repo-todo-verifier
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {org/repo-path}
    Base Branch: {base-branch}
    Review Timestamp: {timestamp}
```

**What the agent does (defined in agent, not by prompt):**
- Reads TODO file and parses all items
- Verifies each TODO against actual code changes
- Writes verification report (`TODO-VERIFY-{org}_{repo}.md`) to review directory

**Example filenames**: For repository `github.com/sters/complex-ai-workspace`:
- Code review: `REVIEW-github.com_sters_complex-ai-workspace.md`
- TODO verification: `TODO-VERIFY-github.com_sters_complex-ai-workspace.md`

**Important**: Launch ALL agents (both review and verification for all repos) in parallel in a single message. Pass the same `{timestamp}` value to all agents.

### 5. Collect Review Results and Create Summary Report

After all review agents complete, use the Task tool to launch the `workspace-collect-reviews` agent:

```yaml
Task tool:
  subagent_type: workspace-collect-reviews
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Review Timestamp: {timestamp}
```

**What the agent does (defined in agent, not by prompt):**
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
