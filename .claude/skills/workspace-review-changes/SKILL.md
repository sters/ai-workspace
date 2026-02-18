---
name: workspace-review-changes
description: Review code changes and generate review reports
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

### 3. Launch Review and Verification Agents

For each repository in the workspace, launch **both** agents in parallel in background:

#### Code Review Agent

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

#### TODO Verification Agent

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

**Do NOT wait for agents to complete.** Proceed immediately to Step 4.

### 4. Report Agents Launched

Report the launched agents to the user immediately.

- Number of review agents launched
- Number of verification agents launched
- Review directory path

## Example Usage

### Example 1: Review Current Workspace

```
User: Review the changes in my current workspace
Assistant: Let me review the workspace. First, I'll identify which workspace you're working in...
[Identifies 3 repositories, launches 6 agents (3 review + 3 verification) in background]
Launched 6 review agents in background for 3 repositories.
Review reports will be written to: workspace/feature-user-auth-20260116/artifacts/reviews/20260116-103045/
Use /workspace-show-status to monitor progress.
```

### Example 2: Review Specific Workspace

```
User: Review workspace/feature-login-fix-20260115
Assistant: I'll review the workspace/feature-login-fix-20260115 workspace...
[Identifies 2 repositories, launches 4 agents (2 review + 2 verification) in background]
Launched 4 review agents in background for 2 repositories.
Use /workspace-show-status to monitor progress.
```

## After Launching

After launching review agents, report directly to the user immediately (**do NOT wait for agents to complete**):
- Number of agents launched and repository names
- Review directory path
- Suggest `/workspace-show-status {workspace-name}` to monitor progress

## After All Agents Complete

When all background agents have completed (confirmed via `<task-notification>`), use `AskUserQuestion` to let the user choose the next action:

```yaml
AskUserQuestion:
  question: "All review agents have completed. What would you like to do next?"
  header: "Next step"
  options:
    - label: "/workspace-create-or-update-pr (Recommended)"
      description: "Create pull requests"
    - label: "/workspace-show-status"
      description: "Check detailed review results"
    - label: "/workspace-execute"
      description: "Continue executing TODO items if issues were found"
```

After the user selects an option, invoke the corresponding skill with the workspace name as argument. Do NOT invoke other skills automatically before asking.

## Notes

- The skill delegates actual review work to the `workspace-repo-review-changes` agent
- Each repository is reviewed independently and in parallel
- Review results are timestamped to avoid overwriting previous reviews
- The summary provides a high-level view while individual reports contain detailed findings
- Launch all repository review agents in parallel for faster execution
- Always replace slashes (`/`) in repository paths with underscores (`_`) when generating filenames
- **Non-blocking**: This skill returns immediately after launching agents. It does NOT wait for agents to complete. Use `/workspace-show-status` to monitor progress. Once all reviews are done, proceed to `/workspace-create-or-update-pr`.
