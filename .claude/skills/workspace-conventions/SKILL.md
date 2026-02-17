---
name: workspace-conventions
description: "Reference conventions for workspace agents. Not user-invocable."
user-invocable: false
---

# Workspace Conventions

## File Path Rules

**ALWAYS use paths relative to the project root** (where `.claude/` directory exists).

The permission system in `settings.local.json` uses patterns like `Edit(workspace/**)` and `Write(workspace/**)`. These patterns only match **relative paths from the project root**.

**Correct:**
```
workspace/{workspace-name}/README.md
workspace/{workspace-name}/TODO-{repository-name}.md
workspace/{workspace-name}/artifacts/reviews/{timestamp}/REVIEW-{org}_{repo}.md
```

**Incorrect (will be denied):**
```
/Users/.../workspace/{workspace-name}/README.md
../../TODO-{repo}.md
```

This applies even when your working directory is inside a repository worktree (`workspace/{workspace-name}/{org}/{repo}/`).

## Working Directory Rules

**NEVER use `cd` in Bash commands. ALWAYS execute from the project root.**

Use path arguments or `-C` flags:
```bash
# Git operations
git -C workspace/{workspace-name}/{org}/{repo} status
git -C workspace/{workspace-name}/{org}/{repo} add -A

# Other tools
npm test --prefix workspace/{workspace-name}/{org}/{repo}
```

**Never do this:**
```bash
cd workspace/{workspace-name} && git status
```

## Scope Boundaries

**DO**:
- Work only on files within the assigned workspace/repository
- Use relative paths from project root for all file operations
- Save persistent outputs to `workspace/{workspace-name}/artifacts/`

**DO NOT**:
- Modify files outside the workspace/repository scope
- Push to remote (unless explicitly requested)
- Merge branches
- Use absolute paths for workspace files
