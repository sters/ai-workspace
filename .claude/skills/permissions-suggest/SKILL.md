---
name: permissions-suggest
description: Detect and suggest blocked Bash commands from recent sessions
---

# permissions-suggest

## Overview

This skill scans recent Claude Code session debug logs to detect Bash commands that were blocked (permission denied) and helps the user add them to `settings.local.json`.

## Steps

### 1. Run Detection Script

Run the detection script to find blocked commands:

```bash
python3 .claude/skills/permissions-suggest/scripts/detect-blocked-commands.py {num_sessions}
```

**Arguments**:
- `num_sessions`: Number of recent sessions to scan (default: 10)

**Output**: JSON object with two keys:
```json
{
  "blocked": [
    {"ruleContent": "pnpm --filter contacts test:*", "count": 5},
    {"ruleContent": "npm run lint:*", "count": 3}
  ],
  "missingAbsolute": [
    {"ruleContent": "/Users/.../ai-workspace/.claude/scripts/**/*:*", "source": "Bash(./.claude/scripts/**/*:*)", "type": "missing_absolute"}
  ]
}
```

### 2. Handle Results

**If both `blocked` and `missingAbsolute` are empty:**
Report to the user:
> No blocked Bash commands or missing path coverage found in the last {n} sessions.

**If suggestions found:**
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

### 3. Update Settings

For each selected rule:
1. Read the current `.claude/settings.local.json`
2. Add the rule in format `Bash({ruleContent})` to `permissions.allow`
3. Write the updated settings file

### 4. Report Results

Report which rules were added:
> Added {n} rules to .claude/settings.local.json:
> - Bash({rule1})
> - Bash({rule2})

## Example Usage

```
User: /permissions-suggest 50
Assistant: Found 5 blocked Bash commands in recent 50 sessions.

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

- The script only detects Bash commands, not other tools
- Commands already in settings.local.json are filtered out
- The script reads debug logs from `~/.claude/debug/`
- Session-to-debug mapping uses the session ID from `.jsonl` filenames
