---
name: workspace-review-changes
description: Review code changes and generate review reports
context: fork
---

# workspace-review-changes

## Overview

This skill reviews code changes across all repositories in a workspace by delegating to the `workspace-repo-review-changes` agent for each repository. It collects all review results and provides a comprehensive summary.

**Paths:** Use relative paths from project root for all workspace file operations (see CLAUDE.md for details).

## Arguments

This skill receives `$ARGUMENTS` from the caller. Parse to extract:
- Workspace name (required): `workspace/{workspace-name}` or just `{workspace-name}`
- Example: `workspace/feature-user-auth-20260116` or `feature-user-auth-20260116`

If `$ARGUMENTS` is empty, abort with message:
> Please specify a workspace. Example: `/workspace-review-changes workspace/feature-user-auth-20260116`

## Steps

### 1. Find Repositories

Find all repository worktrees in the workspace:

```bash
./.claude/scripts/list-workspace-repos.sh {workspace-name}
```

For each repository:
1. Extract the repository name
2. Determine the base branch (from README.md)
3. Prepare parameters for the review agent

### 2. Create Reviews Directory

Run the script to create a timestamped review directory. **Important**: Capture the output path from the Bash tool result and reuse it for all parallel agents to ensure consistency.

```bash
.claude/skills/workspace-review-changes/scripts/prepare-review-dir.sh {workspace-name}
```

The script outputs the created directory path to stdout (e.g., `workspace/{workspace-name}/artifacts/reviews/20260116-103045`). Use this path in subsequent steps.

### 3. Delegate to Review and Verification Agents for Each Repository

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

**Example filenames**: For repository `github.com/sters/ai-workspace`:
- Code review: `REVIEW-github.com_sters_ai-workspace.md`
- TODO verification: `TODO-VERIFY-github.com_sters_ai-workspace.md`

**Important**: Launch ALL agents (both review and verification for all repos) in parallel in a single message. Pass the same `{timestamp}` value to all agents.

### 4. Collect Review Results and Create Summary Report

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

### 5. Commit Workspace Snapshot

After all reviews complete, commit the workspace changes (including review results):

```bash
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name}
```

### 6. Present Summary to User

Display a concise summary to the user using ONLY the statistics returned from the `workspace-collect-reviews` agent response.

**CRITICAL: DO NOT read the SUMMARY.md or any review files to present results.** This will cause context explosion.

Present to user:
1. The stats from the agent response (repos, critical, warnings, suggestions, completion rate)
2. The file path to SUMMARY.md for detailed review
3. Ask if they want to proceed to PR creation

Example output:
```
## Review Complete

Reviewed 2 repositories in workspace/feature-x-20260116

**Results**: 0 critical, 3 warnings, 5 suggestions
**TODO Completion**: 95% (19/20 items verified)

**Full Report**: workspace/feature-x-20260116/artifacts/reviews/20260116-103045/SUMMARY.md

Would you like to create pull requests?
```

## Example Usage

### Example 1: Review Current Workspace

```
User: Review the changes in my current workspace
Assistant: Let me review the workspace. First, I'll identify which workspace you're working in...
[Identifies repositories, launches review agents]
[After completion]
Review complete! I found 2 critical issues and 5 warnings across 3 repositories.
Summary: workspace/feature-user-auth-20260116/artifacts/reviews/20260116-103045/SUMMARY.md
```

### Example 2: Review Specific Workspace

```
User: Review workspace/feature-login-fix-20260115
Assistant: I'll review the workspace/feature-login-fix-20260115 workspace...
[Identifies 2 repositories, launches agents in parallel]
[After completion]
Review complete! All changes look good with 0 critical issues and 3 suggestions.
```

## Structured Return (CRITICAL)

After completing all steps, return a structured completion message. **Do NOT invoke other skills or use AskUserQuestion for next steps.** The main context handles routing.

```
SKILL_COMPLETE: workspace-review-changes
WORKSPACE: {workspace-name}
REVIEW_DIR: workspace/{workspace-name}/artifacts/reviews/{timestamp}
SUMMARY_FILE: workspace/{workspace-name}/artifacts/reviews/{timestamp}/SUMMARY.md
REVIEW_STATS: repos={n}, critical={c}, warnings={w}, suggestions={s}
TODO_STATS: verified={v}, unverified={u}, completion={pct}%
SUMMARY: Reviewed {n} repositories. {c} critical issues, {w} warnings, {s} suggestions. TODO completion: {pct}%.
NEXT_ACTION: workspace-create-or-update-pr {workspace-name}
```

## Notes

- The skill delegates actual review work to the `workspace-repo-review-changes` agent
- Each repository is reviewed independently and in parallel
- Review results are timestamped to avoid overwriting previous reviews
- The summary provides a high-level view while individual reports contain detailed findings
- Launch all repository review agents in parallel for faster execution
- If a repository review fails, continue with others and report which failed
- Always replace slashes (`/`) in repository paths with underscores (`_`) when generating filenames
