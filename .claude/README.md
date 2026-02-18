# .claude Directory

This directory contains Claude Code configuration for the multi-repository workspace manager.

## Directory Structure

```
.claude/
├── agents/          # Sub-agent definitions (invoked via Task tool)
├── skills/          # User-facing skills (/slash-commands)
├── scripts/         # Shared shell scripts
└── settings.local.json
```

## File Path Rules (CRITICAL)

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

This is a permission requirement. The permission system in `settings.local.json` uses patterns like `Edit(workspace/**)` and `Write(workspace/**)`. These patterns only match **relative paths from the project root**.

**Correct:**
```
workspace/{workspace-name}/README.md
workspace/{workspace-name}/TODO-{repo}.md
```

**Incorrect (will be denied):**
```
/Users/sters/go/src/github.com/.../workspace/{workspace-name}/README.md
../../TODO-{repo}.md
```

This applies to all agents and skills that read/write workspace files, especially when the working directory is inside a repository worktree (`workspace/{workspace-name}/{org}/{repo}/`).

## Working Directory Rules (CRITICAL)

**NEVER use `cd` in Bash commands. ALWAYS execute commands from the project root.**

The project root is the directory containing `.claude/` (i.e., the ai-workspace root). All Bash commands — including git operations, test runners, linters, and build tools — MUST be executed from this root using either:
- The `-C` flag (for git): `git -C workspace/{workspace-name}/{org}/{repo} status`
- Absolute or relative paths from root: `npm test --prefix workspace/{workspace-name}/{org}/{repo}`

This applies to **all agents and skills** without exception.

**Correct:**
```bash
git -C workspace/feature-auth-20260116/github.com/org/repo add -A
git -C workspace/feature-auth-20260116/github.com/org/repo status
git -C workspace/feature-auth-20260116/github.com/org/repo commit -m "fix: something"
```

**Incorrect (NEVER do this):**
```bash
cd workspace/feature-auth-20260116 && git add -A && git status
cd workspace/feature-auth-20260116/github.com/org/repo && npm test
```

**Why this matters:**
- `cd` changes the working directory, which breaks relative path resolution for file tools (Read, Write, Edit, Glob, Grep)
- Permission patterns in `settings.local.json` are matched from the project root
- Agents and skills must maintain a consistent working directory throughout their execution

## Implementation Policies for Agents

Agents are autonomous workers that perform specific tasks. They are invoked via the `Task` tool with `run_in_background: true`.

**Naming Convention:**
- `workspace-repo-{action}` - Operates on a single repository within a workspace
- `workspace-{action}` - Operates on the entire workspace (e.g., `workspace-todo-coordinator`)

**Directory Structure:**
```
.claude/agents/
├── {agent-name}.md                    # Agent definition
├── scripts/{agent-name}/              # Scripts used by this agent
│   └── {script}.sh
└── templates/{agent-name}/            # Templates used by this agent
    ├── {template}.md                  # Output templates
    └── {completion-report}.md         # Completion report format
```

**Design Principles:**
- **Single responsibility**: One agent, one job
- **Scope awareness**: Repository-scoped agents don't touch other repos
- **Template-driven output**: Use templates for consistent formatting
- **Completion reports**: Always report results in a structured format
- **No nesting**: Agents cannot invoke other agents (use skills for orchestration)
- **Minimal response**: Final response must be minimal (see Context Isolation below)
- **Autonomous behavior**: Agents define their own behavior, not callers (see below)

**Autonomous Agent Pattern (CRITICAL):**

Agents must be **self-driven**, not **prompt-driven**. The agent's behavior should be defined in the agent file itself, not in the prompts passed from skills.

1. **Core Behavior section**: Every agent MUST have a `## Core Behavior` section that defines:
   - The agent's mission in one sentence
   - The steps it always performs, regardless of how it's invoked

   ```markdown
   ## Core Behavior

   **Your mission is simple and unwavering: {mission}.**

   You do NOT depend on external prompts to determine what to do. Regardless of how you are invoked, you always:
   1. {step 1}
   2. {step 2}
   3. {step 3}
   ```

2. **Minimal prompts from skills**: Skills should pass only essential parameters:
   ```yaml
   # Good - parameters only
   prompt: |
     Workspace: {workspace-name}
     Repository: {org/repo-path}

   # Bad - includes behavioral instructions
   prompt: |
     Execute tasks in workspace.
     Read the TODO file and complete all items.
     Workspace: {workspace-name}
     Repository: {org/repo-path}
   ```

3. **Why this matters**:
   - Agents behave consistently regardless of how they're called
   - Changes to agent behavior are made in one place (the agent file)
   - Prompts don't accidentally override or conflict with agent design
   - Easier to test and debug

**Background Task Result Handling (CRITICAL):**

When using `Task` tool with `run_in_background: true`, results arrive automatically via `<task-notification>` messages. **NEVER use `TaskOutput` to retrieve results.** `TaskOutput` returns the full agent execution transcript (hundreds of KB), which bloats context and can crash the session.

Correct flow:
1. Call `Task` with `run_in_background: true` → get agent ID
2. **Wait** for `<task-notification>` to arrive automatically (contains agent's final response in `<result>` tag)
3. Parse the notification's `<result>` content (the agent's minimal response)

```yaml
# CORRECT: Wait for notification
Task tool:
  run_in_background: true
  ...
# → <task-notification> arrives automatically with result

# WRONG: Do NOT do this
TaskOutput tool:
  task_id: {agent-id}
  block: true
# → Returns full transcript (100-400KB), destroys context
```

**Context Isolation (CRITICAL):**

Agents run in background via `Task` tool, but their final response returns to the parent context. To prevent context bloat:

1. **Write details to files, not to response**: All detailed results (review findings, execution logs, etc.) MUST be written to files in the workspace
2. **Return only paths and counts**: Final response should be 2-3 lines max:
   ```
   DONE: {summary-in-one-sentence}
   OUTPUT: {path-to-result-file}
   STATS: {key-metrics-only}
   ```
3. **No verbose explanations**: Parent reads the output file if details are needed

Example good response:
```
DONE: Reviewed 5 files, found 2 critical issues
OUTPUT: workspace/feature-auth-20260116/artifacts/reviews/20260116-103045/github.com_org_repo.md
STATS: critical=2, warnings=3, suggestions=5
```

Example bad response:
```
## Review Complete
I reviewed all 5 files and found the following issues:
### Critical Issues
1. In src/auth.ts line 45, there is a SQL injection vulnerability...
[... 50 more lines of details ...]
```

**Prompt Structure (`{agent-name}.md`):**
```markdown
---
name: {agent-name}
description: |
  Use this agent to {what it does}.
  Delegate to this agent when you need to:
  - {use case 1}
  - {use case 2}
tools:
  - Read
  - Write
  - ...
skills:
  - workspace-conventions
---

# {Agent Title}

{Role description - "You are a specialized agent for..."}

## Core Behavior

**Your mission is simple and unwavering: {mission in one sentence}.**

You do NOT depend on external prompts to determine what to do. Regardless of how you are invoked, you always:
1. {step 1}
2. {step 2}
3. {step 3}

## Initial Context

When invoked, you will receive only:
- **{Parameter}**: {description}

## Execution Steps

### 1. {Step Name}
{Instructions}

### 2. {Step Name}
{Instructions}

## Output

{What the agent produces and where}

## Guidelines

{Important rules and constraints}

## Communication

{Completion report format, reference to templates/{agent-name}/}
```

## Implementation Policies for Skills

Skills are user-facing commands (`/skill-name`) that orchestrate agents and scripts.

**Naming Convention:**
- `workspace-{action}` - Actions on workspaces (e.g., `workspace-init`, `workspace-execute`)
- `workspace-show-{target}` - Display information (e.g., `workspace-list`, `workspace-show-status`)
- `workspace-{action}-{target}` - Specific actions (e.g., `workspace-update-todo`)

**Directory Structure:**
```
.claude/skills/{skill-name}/
├── SKILL.md                           # Skill definition and instructions
├── scripts/                           # Scripts used by this skill
│   └── {script}.sh
└── templates/                         # Templates used by this skill
    └── {template}.md
```

**Design Principles:**
- **User interface**: Skills are the primary way users interact with the system
- **Orchestration**: Complex skills coordinate multiple agents
- **Script preference**: Simple tasks use scripts directly, complex tasks delegate to agents
- **Confirmation prompts**: Destructive actions require user confirmation
- **Non-blocking orchestration**: Most orchestration skills launch agents in background and return immediately
- **Blocking orchestration**: `workspace-init` waits for agents because user interaction may be needed during review

**Skill Categories:**

| Category | `user-invocable:` | Purpose |
|----------|-------------------|---------|
| **Inline** | true | Simple, low-overhead skills (list, show, add-repo, delete, prune) |
| **Orchestration (blocking)** | true | Wait for agents, supports user interaction (init) |
| **Orchestration (non-blocking)** | true | Launch background agents and return immediately (execute, review, PR, update-todo) |
| **Reference** | `false` | Passive knowledge injected into agents via `skills:` field |

### Reference Skills

Reference skills (`user-invocable: false`) are not shown in the `/` menu. They provide shared conventions that agents load via the `skills:` field in their frontmatter.

**Example:** `workspace-conventions` consolidates file path rules, working directory rules, and scope boundaries. All workspace agents reference it:

```yaml
# In agent frontmatter
skills:
  - workspace-conventions
```

**Template:**
```markdown
---
name: {skill-name}
description: "{What conventions this provides}"
user-invocable: false
---

# {Title}

{Consolidated conventions and rules}
```

### Orchestration Skills (Non-blocking)

Orchestration skills launch background agents and return immediately. They run inline (no `context: fork`) to avoid blocking the main conversation.

**When to use:** Skills that delegate work to agents and don't need to wait (e.g., execute, review, PR creation).

**Key principles:**
- Launch agents with `run_in_background: true` and return immediately
- Do NOT wait for agents to complete
- Report what was launched and suggest `/workspace-show-status` to monitor progress
- Do NOT invoke other skills automatically — let the user decide next steps

**Orchestration Skill Template:**
```markdown
---
name: {skill-name}
description: {Short description}
---

# {skill-name}

## Steps
### 1. {Step Name}
{Launch agents with run_in_background: true}

## After Completion
Report directly to the user:
- What agents were launched
- Suggest next action (e.g., `/workspace-show-status`)
```

### Inline Skill Template

Inline skills run in the main conversation context. Use for simple, low-overhead operations.

```markdown
---
name: {skill-name}
description: {Short description}
---

# {skill-name}

## Overview

{What this skill does, when to use it}

**Paths:** Use relative paths from project root (see CLAUDE.md for details).

## Steps

### 1. {Step Name}
{Instructions}

## Notes

{Additional information}
```

## Shared Scripts

Scripts used across multiple skills/agents are placed in `.claude/scripts/`:
```
.claude/scripts/
├── list-workspaces.sh                 # List all workspaces
├── list-workspace-repos.sh            # List repositories in a workspace
├── list-workspace-todos.sh            # List TODO files in a workspace
└── commit-workspace-snapshot.sh       # Commit workspace changes
```
