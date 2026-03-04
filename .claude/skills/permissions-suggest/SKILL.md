---
name: permissions-suggest
description: Detect and suggest blocked tool commands from recent sessions
---

# permissions-suggest

## Overview

This skill scans recent Claude Code session debug logs to detect tool commands that were blocked (permission denied) and helps the user add them to `settings.local.json`. It detects blocks across all tools (Bash, Write, Edit, NotebookEdit).

## Steps

### 1. Run Detection Script

Run the detection script to find blocked commands:

```bash
python3 .claude/skills/permissions-suggest/scripts/detect-blocked-commands.py {num_sessions}
```

**Arguments**:
- `num_sessions`: Number of recent sessions to scan (default: 10)

**Output**: JSON object with three keys:
```json
{
  "blocked": [
    {"ruleContent": "pnpm --filter contacts test:*", "count": 5},
    {"ruleContent": "npm run lint:*", "count": 3}
  ],
  "toolBlocks": [
    {"tool": "Write", "type": "setMode", "mode": "acceptEdits", "count": 3},
    {"tool": "Edit", "type": "setMode", "mode": "acceptEdits", "count": 4},
    {"tool": "Bash", "type": "addDirectories", "directories": ["/path/..."], "count": 1},
    {"tool": "Bash", "type": "noSuggestion", "count": 5}
  ],
  "missingAbsolute": [
    {"ruleContent": "/Users/.../ai-workspace/.claude/scripts/**/*:*", "source": "Bash(./.claude/scripts/**/*:*)", "tool": "Bash", "type": "missing_absolute"},
    {"ruleContent": "/Users/.../ai-workspace/workspace/**", "source": "Edit(workspace/**)", "tool": "Edit", "type": "missing_absolute"}
  ]
}
```

### 2. Handle Results

**If `blocked`, `toolBlocks`, and `missingAbsolute` are all empty:**
Report to the user:
> No blocked tool commands or missing path coverage found in the last {n} sessions.

**If `toolBlocks` has entries:**
Display them as informational output (these are not actionable via settings.local.json rules):

- `setMode` entries: "{tool} tool was blocked {count} times. Suggested fix: use `acceptEdits` mode (or run with `--allowedTools {tool}`)"
- `addDirectories` entries: "Bash was blocked {count} times for directory access to: {directories}"
- `noSuggestion` entries: "{tool} was blocked {count} times with no specific rule suggestion"

**If `blocked` or `missingAbsolute` has entries:**
Present both categories in a single `AskUserQuestion` with `multiSelect: true`:

- **Blocked commands**: Format as `"{ruleContent} ({count}x blocked)"`
- **Missing absolute coverage**: Format as `"{ruleContent} (abs for {source})"`

Combine both into one options list (up to 4 total, prioritizing blocked commands first).

```yaml
AskUserQuestion tool:
  questions:
    - question: "Which rules would you like to add?"
      header: "Permissions"
      multiSelect: true
      options:
        # Mix of blocked commands and missing absolute coverage
        # Blocked: "{ruleContent} ({count}x blocked)"
        # Missing: "{ruleContent} (abs for Bash({source}))"
```

Only show `AskUserQuestion` for actionable items (`blocked` + `missingAbsolute`). `toolBlocks` are informational only.

### 3. Update Settings

For each selected rule:
1. Read the current `.claude/settings.local.json`
2. Add the rule to `permissions.allow`:
   - **Blocked commands**: format as `Bash({ruleContent})`
   - **Missing absolute**: format as `{tool}({ruleContent})` (use the `tool` field from the output, e.g. `Edit(...)`, `Write(...)`, `Bash(...)`)
3. Write the updated settings file

### 4. Report Results

Report which rules were added:
> Added {n} rules to .claude/settings.local.json:
> - Bash({rule1})
> - Bash({rule2})

If `toolBlocks` were present, remind the user of the non-actionable blocks after reporting added rules.

## Example Usage

```
User: /permissions-suggest 50
Assistant: Found 5 blocked Bash commands and 7 other tool blocks in recent 50 sessions.

Other tool blocks (informational):
- Write tool was blocked 3 times. Suggested fix: use `acceptEdits` mode (or run with `--allowedTools Write`)
- Bash was blocked 5 times with no specific rule suggestion

[AskUserQuestion with multiSelect]
Which commands would you like to allow?
- go get:* (36x blocked)
- pnpm --filter contacts test:* (7x blocked)
- go version:* (6x blocked)
- git submodule update:* (3x blocked)

User: [selects first two]
Assistant: Added 2 rules to .claude/settings.local.json:
- Bash(go get:*)
- Bash(pnpm --filter contacts test:*)
```

## Notes

- The script detects blocks across all tools (Bash, Write, Edit, NotebookEdit)
- Only Bash `addRules` suggestions are actionable via settings.local.json
- Other tool blocks (setMode, addDirectories, noSuggestion) are shown as informational
- Commands already in settings.local.json are filtered out
- The script reads debug logs from `~/.claude/debug/`
- Session-to-debug mapping uses the session ID from `.jsonl` filenames
