---
name: workspace-init
description: "Use when the user wants to start working on a task, ticket, or feature. Triggered by: ticket URLs (Jira, GitHub Issues, Linear, etc.), task descriptions, or requests like 'work on this', 'implement X', 'fix X', 'これをすすめて', 'これやって'. IMPORTANT: Before creating a new workspace, ALWAYS run /workspace-list first to check if a workspace already exists for the same ticket/task. If one exists, use /workspace-execute or /workspace-show-status instead. Creates workspace with README, clones repos, and plans TODO items via agents."
context: fork
---

# workspace-init

## Overview

This skill initializes a working environment for development tasks. It orchestrates:
1. Workspace directory setup (via `setup-workspace.sh`)
2. Repository addition with worktrees (via `setup-repository.sh`)
3. README creation with task details
4. Task type branching (research tasks skip TODO planning)
5. TODO planning for each repository (via workspace-repo-todo-planner agent) — *skipped for research*
6. Cross-repository coordination (via workspace-todo-coordinator agent) — *skipped for research*
7. TODO validation and clarification (via workspace-repo-todo-reviewer agent) — *skipped for research*

**After initialization:** Use `/workspace-execute` to work through TODO items and complete the task.

**Paths:** Use relative paths from project root for all workspace file operations (see CLAUDE.md for details).

## Arguments

This skill receives `$ARGUMENTS` from the caller. Parse them to extract:
- Task type, description, repository paths, ticket ID
- Example: `feature user-auth github.com/org/repo PROJ-123`
- Example: `bugfix login-error github.com/org/api github.com/org/frontend`
- Arguments may also be natural language (e.g., "implement retry logic in github.com/org/api")

If `$ARGUMENTS` is empty or missing required information, use AskUserQuestion to gather it.

## Steps

### 1. Understand the Task Requirements

Before running the setup scripts, ensure you have:

- Task type (feature, bugfix, research, etc.)
- Brief description
- Target repository path(s) in org/repo format (e.g., github.com/sters/ai-workspace)
- Ticket ID (optional)

**Note:** Base branch is automatically detected from the remote default (main/master). You don't need to specify it.

**Alias syntax:** If you need to use the same repository multiple times (e.g., separate PRs for dev/prod environments), use the `:alias` suffix:
- `github.com/org/repo:dev` → Creates worktree at `github.com/org/repo___dev/`
- `github.com/org/repo:prod` → Creates worktree at `github.com/org/repo___prod/`

### 2. Run Setup Scripts

#### Step 2a: Create Workspace

Execute the workspace setup script:

```bash
./.claude/skills/workspace-init/scripts/setup-workspace.sh <task-type> <description> [ticket-id]
```

**Examples:**

```bash
# Basic usage
./.claude/skills/workspace-init/scripts/setup-workspace.sh feature user-auth

# With ticket ID
./.claude/skills/workspace-init/scripts/setup-workspace.sh bugfix login-error PROJ-123
```

The script will:
- Create a working directory with proper naming convention
- Initialize git repository with `.gitignore`
- Create `tmp/` directory (gitignored, for temporary files)
- Create `artifacts/` directory (git-tracked, for persistent outputs)
- Generate README.md from template
- Create initial commit

**Capture the workspace name from the last line of output** for use in subsequent steps.

#### Step 2b: Add Repositories

For each repository, execute the repository setup script:

```bash
./.claude/scripts/setup-repository.sh <workspace-name> <org/repo-path>
```

**Examples:**

```bash
# Basic usage
./.claude/scripts/setup-repository.sh feature-user-auth-20260206 github.com/org/repo

# Override base branch (when user explicitly specifies)
BASE_BRANCH=develop ./.claude/scripts/setup-repository.sh feature-user-auth-20260206 github.com/org/repo

# With alias (for multiple worktrees from same repo)
./.claude/scripts/setup-repository.sh feature-user-auth-20260206 github.com/org/repo:dev
```

The script will:
- Clone the repository if not already cloned (to `repositories/` directory)
- Update the repository with `git fetch --all --prune`
- Auto-detect the base branch from remote default
- Create a git worktree in the workspace with a new feature branch

**After running the script**, update the README.md Repositories section:

```markdown
## Repositories

- **repo-name**: `github.com/org/repo` (base: `main`)
```

### 3. Fill in README.md

After setup completes, update the generated `README.md` with:

- Clear objective description
- Context and background
- Requirements and acceptance criteria
- Related resources (issues, docs, etc.)

**IMPORTANT: Write only confirmed facts, never assumptions or guesses.**

- Only include information that is explicitly provided by the user or retrieved from linked resources
- If essential information is missing (objective, requirements, context), use AskUserQuestion to ask the user
- Do NOT fill in placeholder text or make up details
- Leave sections empty with `<!-- TBD -->` if information is not available and user cannot provide it
- Read linked resources (Jira tickets, PRs, documentation) using appropriate tools to get accurate details

**DO NOT explore or analyze the repository codebase at this step.** Repository analysis is done by the TODO planner agents in the next step. This step focuses only on capturing task requirements from the user and linked resources.

This README is the source of truth that the TODO planner agents will read. Accuracy is critical.

### 4. Task Type Branching

After filling in README.md, check the task type to determine the next steps:

- If `**Task Type**` is `research`, `investigation`, `documentation`, or `design-doc` → **Skip Steps 5-7** (TODO planning is not needed). Go directly to **Step 8** (Commit).
- For all other task types (feature, bugfix, etc.) → Continue with **Step 5** below.

**Why skip?** These task types use the `workspace-researcher` agent (invoked via `/workspace-execute`) which reads directly from README.md. The agent explores repositories and produces a document (research report, design doc, etc.) as its output. Creating TODO items would cause duplicate work — the planner would explore the codebase to create TODOs, then the researcher would explore the same codebase again.

**Guideline**: Use this path for tasks whose primary output is a **document** based on cross-repository exploration, not code changes.

### 5. Call workspace-repo-todo-planner for Each Repository

For each repository in the workspace, invoke the `workspace-repo-todo-planner` agent:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-planner
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {org/repo-path}
```

**What the agent does (defined in agent, not by prompt):**
- Reads workspace README.md to understand the task
- Analyzes repository structure and documentation
- Creates detailed TODO items in `TODO-{repo-name}.md`

**Run multiple planners in parallel** if there are multiple repositories.

Each planner will:
- Read the workspace README.md to understand the task
- Analyze the repository structure and documentation
- Create detailed, actionable TODO items in `TODO-{repo-name}.md`

### 6. Call workspace-todo-coordinator

After all TODO planners complete, invoke the `workspace-todo-coordinator` agent:

```yaml
Task tool:
  subagent_type: workspace-todo-coordinator
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
```

**What the agent does (defined in agent, not by prompt):**
- Read all TODO files
- Analyze dependencies between repositories
- Restructure TODOs to maximize parallel execution
- Add coordination notes to README.md

### 7. Call workspace-repo-todo-reviewer for Each Repository

After coordination completes, invoke the `workspace-repo-todo-reviewer` agent for each repository:

```yaml
Task tool:
  subagent_type: workspace-repo-todo-reviewer
  run_in_background: true
  prompt: |
    Workspace: {workspace-name}
    Repository: {repository-name}
```

**Run multiple reviewers in parallel** for all repositories.

**What the agent does (defined in agent, not by prompt):**
- Validates each TODO item for specificity, actionability, and alignment
- Marks unclear items with `[NEEDS_CLARIFICATION]` tags
- Returns a summary of issues (BLOCKING and UNCLEAR)

**After all reviewers complete:**

1. Collect results from all reviewers
2. If any BLOCKING issues exist:
   - Use AskUserQuestion to ask the user for clarification
   - Update the TODO files with the answers
   - Re-run reviewers if significant changes were made
3. If only UNCLEAR issues exist:
   - Present them to the user and ask whether to proceed or clarify
4. If no issues (STATUS: CLEAN for all repos):
   - Proceed to commit

### 8. Commit Workspace Files

After review completes (and any clarifications are resolved), or directly after Step 3 for research tasks, commit the workspace files:

```bash
# For research/investigation tasks (no TODO files):
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name} "Initialize research workspace"

# For standard tasks (with TODO files):
./.claude/scripts/commit-workspace-snapshot.sh {workspace-name} "Add TODO items for all repositories"
```

### 9. Display Workspace Files

After committing, display the relative paths of all workspace files for the user:

```
Workspace files created:
- workspace/{workspace-name}/README.md
- workspace/{workspace-name}/TODO-{repo1-name}.md
- workspace/{workspace-name}/TODO-{repo2-name}.md
...
```

List all TODO files that were created (one per repository).

## Example Usage

### Example 1: Single Repository (Feature)

```
User: Initialize a workspace for user authentication feature in github.com/org/repo
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-user-auth-20260206
  2. [Runs setup-repository.sh] → Clones repo, creates worktree
  3. [Updates README.md Repositories section]
     [Fills in README.md with task details (Objective, Context, etc.)]
  4. [Task Type: feature → Continue to Step 5]
  5. [Calls workspace-repo-todo-planner] → Creates TODO-repo.md
  6. [Calls workspace-todo-coordinator] → Optimizes (single repo, minimal changes)
  7. [Calls workspace-repo-todo-reviewer] → Validates TODO items
     [If issues found, asks user for clarification]
  8. [Commits workspace files]
  9. [Displays workspace files]:
     - workspace/feature-user-auth-20260206/README.md
     - workspace/feature-user-auth-20260206/TODO-repo.md
  Done!
```

### Example 2: Multiple Repositories (Feature)

```
User: Initialize a workspace for adding product IDs to cart, involving:
      - github.com/org/proto (protobuf definitions)
      - github.com/org/api (API implementation)
      - github.com/org/frontend (UI)
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-product-ids-20260206
  2. [Runs setup-repository.sh 3 times] → Adds 3 repos sequentially
  3. [Updates README.md Repositories section with all 3 repos]
     [Fills in README.md with task details (Objective, Context, etc.)]
  4. [Task Type: feature → Continue to Step 5]
  5. [Calls 3 Task tools in single message for workspace-repo-todo-planner] → Creates TODO files in parallel
  6. [Calls workspace-todo-coordinator] → Optimizes for parallel execution
  7. [Calls 3 Task tools in single message for workspace-repo-todo-reviewer] → Validates all TODOs in parallel
     [If issues found, asks user for clarification]
  8. [Commits workspace files]
  9. [Displays workspace files]:
     - workspace/feature-product-ids-20260206/README.md
     - workspace/feature-product-ids-20260206/TODO-proto.md
     - workspace/feature-product-ids-20260206/TODO-api.md
     - workspace/feature-product-ids-20260206/TODO-frontend.md
  Done!
```

### Example 3: Research Task (Skips TODO Planning)

```
User: Investigate how authentication works across github.com/org/api and github.com/org/gateway
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/research-auth-flow-20260206
  2. [Runs setup-repository.sh 2 times] → Adds 2 repos
  3. [Updates README.md Repositories section]
     [Fills in README.md with research objectives]
  4. [Task Type: research → Skip Steps 5-7]
  8. [Commits workspace files]
  9. [Displays workspace files]:
     - workspace/research-auth-flow-20260206/README.md
     (No TODO files — research uses workspace-researcher agent via /workspace-execute)
  Done!
```

### Example 4: Same Repository with Aliases (Dev/Prod)

```
User: Initialize a workspace for deploying a config change to both dev and prod,
      creating separate PRs for each in github.com/org/infra
Assistant:
  1. [Runs setup-workspace.sh] → Creates workspace/feature-config-change-20260206
  2. [Runs setup-repository.sh with github.com/org/infra:dev]
     [Runs setup-repository.sh with github.com/org/infra:prod]
  3. [Updates README.md with both entries]
     [Fills in README.md with task details]
  4. [Task Type: feature → Continue to Step 5]
  5. [Calls 2 Task tools in single message for workspace-repo-todo-planner]
  6. [Calls workspace-todo-coordinator]
  7. [Calls 2 Task tools in single message for workspace-repo-todo-reviewer]
     [If issues found, asks user for clarification]
  8. [Commits workspace files]
  9. [Displays workspace files]:
      - workspace/feature-config-change-20260206/README.md
      - workspace/feature-config-change-20260206/TODO-infra___dev.md
      - workspace/feature-config-change-20260206/TODO-infra___prod.md
  Done! Each alias will result in a separate PR.
```

## Structured Return (CRITICAL)

After completing all steps, return a structured completion message. **Do NOT invoke other skills or use AskUserQuestion for next steps.** The main context handles routing.

### For standard tasks (feature, bugfix, etc.)

```
SKILL_COMPLETE: workspace-init
WORKSPACE: {workspace-name}
TASK_TYPE: {task-type}
REPOS: {repo1}, {repo2}, ...
TODO_ITEMS: {total count across all repos}
SUMMARY: Initialized workspace with {n} TODO items across {m} repositories
NEXT_ACTION: workspace-execute {workspace-name}
```

### For research/investigation/documentation tasks

```
SKILL_COMPLETE: workspace-init
WORKSPACE: {workspace-name}
TASK_TYPE: {task-type}
REPOS: {repo1}, {repo2}, ...
SUMMARY: Initialized research workspace with {m} repositories
NEXT_ACTION: workspace-execute {workspace-name}
```

## Notes

- Base branch is auto-detected from remote default unless explicitly specified
- `setup-workspace.sh` creates the workspace directory and README.md template
- `setup-repository.sh` handles cloning, updating, and worktree creation
- TODO files are created by planner agents, not by the setup scripts
- Workspace naming convention: `{task-type}-{ticket-id}-{description}-{date}` or `{task-type}-{description}-{date}`
- For single repository workspaces, the coordinator step is still run but makes minimal changes
- Alias syntax: Use `repo:alias` to create multiple worktrees from the same repository (e.g., `github.com/org/repo:dev`)
