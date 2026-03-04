#!/usr/bin/env python3
"""
detect-blocked-commands.py - Extract blocked tool commands from Claude Code debug logs

Usage: detect-blocked-commands.py [num_sessions] [settings_file]
       detect-blocked-commands.py --session-id <session-id> [settings_file]
Output: JSON object with three keys:
  - "blocked": array of blocked Bash addRules commands not already in settings
  - "toolBlocks": array of other tool permission denials (setMode, addDirectories, noSuggestion)
  - "missingAbsolute": array of relative path rules lacking absolute path coverage

The script:
1. Lists recent session .jsonl files by modification time
2. Extracts session IDs and checks corresponding debug files
3. Parses debug files for permission denied events across all tools
4. Filters out rules that already exist in settings.local.json
5. Detects relative path rules missing corresponding absolute path versions
6. Outputs deduplicated rules with occurrence counts
"""

import json
import os
import re
import sys
from collections import Counter
from pathlib import Path


def get_project_path():
    """Convert current working directory to Claude's project path format."""
    cwd = os.getcwd()
    # Replace / and . with - and remove leading -
    return cwd.replace("/", "-").replace(".", "-").lstrip("-")


def get_recent_session_ids(projects_dir: Path, num_sessions: int) -> list[str]:
    """Get session IDs from recent .jsonl files sorted by modification time."""
    if not projects_dir.exists():
        return []

    jsonl_files = list(projects_dir.glob("*.jsonl"))
    # Sort by modification time (newest first)
    jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)

    session_ids = []
    for f in jsonl_files[:num_sessions]:
        session_ids.append(f.stem)

    return session_ids


_PATH_TOOLS = ("Bash", "Edit", "Write")


def load_existing_rules(settings_file: Path) -> dict[str, set[str]]:
    """Load existing rules from settings.local.json grouped by tool name."""
    empty = {tool: set() for tool in _PATH_TOOLS}
    if not settings_file.exists():
        return empty

    try:
        with open(settings_file) as f:
            settings = json.load(f)

        rules_by_tool: dict[str, set[str]] = {tool: set() for tool in _PATH_TOOLS}
        for rule in settings.get("permissions", {}).get("allow", []):
            for tool in _PATH_TOOLS:
                prefix = f"{tool}("
                if rule.startswith(prefix) and rule.endswith(")"):
                    content = rule[len(prefix):-1]
                    rules_by_tool[tool].add(content)
                    break
        return rules_by_tool
    except (json.JSONDecodeError, OSError):
        return empty


def _parse_suggestions_json(raw: str) -> list:
    """Parse the suggestions JSON from a debug log line.

    The debug log may format the JSON in two ways:
    1. Multi-line: actual newlines and unescaped quotes (older format)
    2. Single-line quoted: wrapped in outer quotes with literal \\n and \\"
       e.g. "[\\n  {\\n    \\"type\\": \\"addRules\\", ...}\\n]"
    """
    stripped = raw.strip()

    # Try direct parse first (multi-line format)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Single-line quoted format: strip trailing quote, then decode escapes
    if stripped.endswith('"'):
        stripped = stripped[:-1]
    # Replace literal two-char sequences with actual characters
    decoded = stripped.replace('\\"', '"').replace("\\n", "\n")
    try:
        return json.loads(decoded)
    except json.JSONDecodeError:
        pass

    return []


def _extract_rule_contents(suggestions: list) -> list[str]:
    """Extract Bash ruleContent values from addRules suggestions."""
    results = []
    for suggestion in suggestions:
        if (
            suggestion.get("type") == "addRules"
            and suggestion.get("behavior") == "allow"
        ):
            for rule in suggestion.get("rules", []):
                if rule.get("toolName") == "Bash":
                    rule_content = rule.get("ruleContent")
                    if rule_content:
                        results.append(rule_content)
    return results


def _classify_suggestions(tool: str, suggestions: list) -> list[dict]:
    """Classify parsed suggestions into typed tool block entries."""
    results = []
    for suggestion in suggestions:
        stype = suggestion.get("type")
        if stype == "addRules" and tool == "Bash":
            # Handled separately via _extract_rule_contents for backward compat
            continue
        elif stype == "addRules":
            # Non-Bash addRules (unlikely but handle gracefully)
            for rule in suggestion.get("rules", []):
                rule_content = rule.get("ruleContent")
                if rule_content:
                    results.append({"tool": tool, "type": "addRules", "ruleContent": rule_content})
        elif stype == "addDirectories":
            dirs = suggestion.get("directories", [])
            results.append({"tool": tool, "type": "addDirectories", "directories": dirs})
        elif stype == "setMode":
            mode = suggestion.get("mode", "")
            results.append({"tool": tool, "type": "setMode", "mode": mode})
    return results


# Max lines to look ahead for "tool permission denied" after a suggestion
_DENIED_LOOKAHEAD = 15

# Pattern to match "Permission suggestions for <Tool>:"
_PERMISSION_MARKER_RE = re.compile(r"Permission suggestions for (\w+): ")


def extract_blocked_commands(debug_file: Path) -> tuple[list[str], list[dict]]:
    """Extract blocked tool commands from a debug log file.

    Returns:
        Tuple of (bash_add_rules: list[str], tool_blocks: list[dict])
        - bash_add_rules: Bash addRules ruleContent values (backward compat)
        - tool_blocks: Other tool blocks (setMode, addDirectories, noSuggestion)
    """
    if not debug_file.exists():
        return [], []

    bash_add_rules = []
    tool_blocks = []

    try:
        with open(debug_file, encoding="utf-8", errors="replace") as f:
            content = f.read()

        lines = content.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i]
            match = _PERMISSION_MARKER_RE.search(line)
            if not match:
                i += 1
                continue

            tool = match.group(1)
            marker = match.group(0)

            # Extract the JSON portion after the marker
            json_start = line.find(marker) + len(marker)
            json_str = line[json_start:].strip()

            # Collect additional lines if the JSON spans multiple lines
            j = i + 1
            if not json_str.rstrip().rstrip('"').endswith("]"):
                while j < len(lines) and not json_str.rstrip().endswith("]"):
                    json_str += "\n" + lines[j]
                    j += 1

            # Look ahead (up to _DENIED_LOOKAHEAD lines) for permission denied
            denied_pattern = f"{tool} tool permission denied"
            is_denied = False
            for k in range(j, min(j + _DENIED_LOOKAHEAD, len(lines))):
                if denied_pattern in lines[k]:
                    is_denied = True
                    break
                # Stop early if we hit the next permission suggestion
                if _PERMISSION_MARKER_RE.search(lines[k]):
                    break

            if is_denied:
                suggestions = _parse_suggestions_json(json_str)

                if not suggestions:
                    # Empty suggestions — blocked with no rule suggested
                    tool_blocks.append({"tool": tool, "type": "noSuggestion"})
                else:
                    # Extract Bash addRules for backward compatibility
                    if tool == "Bash":
                        bash_add_rules.extend(_extract_rule_contents(suggestions))

                    # Classify other suggestion types into tool_blocks
                    tool_blocks.extend(_classify_suggestions(tool, suggestions))

            i = j
    except OSError:
        return [], []

    return bash_add_rules, tool_blocks


def _is_covered_by(rule: str, existing_abs_rules: set[str]) -> bool:
    """Check if a rule is covered by any existing absolute path rule."""
    for existing in existing_abs_rules:
        if existing == rule:
            continue
        # Exact prefix match (e.g., "git -C:*" covers "git -C foo")
        if existing.endswith(":*") and rule.startswith(existing[:-2]):
            return True
        # Glob wildcard coverage (e.g., /**/* patterns)
        if "**" in existing:
            prefix = existing.split("**")[0]
            if rule.startswith(prefix):
                return True
    return False


def find_missing_absolute_coverage(rules_by_tool: dict[str, set[str]], cwd: str) -> list[dict]:
    """Find relative path rules that lack corresponding absolute path coverage.

    Checks Bash, Edit, and Write rules independently.
    """
    missing = []

    for tool, existing_rules in rules_by_tool.items():
        # Collect all existing absolute rules for coverage checks (within this tool)
        existing_abs_rules = {r for r in existing_rules if r.startswith("/")}

        # Build candidates: deduplicate by absolute ruleContent
        candidates: dict[str, str] = {}  # abs_rule -> source (first seen)

        for rule in existing_rules:
            # Identify relative path rules
            # Match: "./.claude/...", ".claude/...", "./workspace/...", "workspace/...", etc.
            rel_path = None
            if rule.startswith("./"):
                rel_path = rule[2:]  # Remove "./"
            elif rule.startswith(".claude/") or rule.startswith("workspace/"):
                rel_path = rule
            else:
                continue

            # Compute absolute version
            abs_rule = cwd + "/" + rel_path

            # Skip if absolute version already exists in settings
            if abs_rule in existing_rules:
                continue

            # Skip if covered by an existing absolute wildcard in settings
            if _is_covered_by(abs_rule, existing_abs_rules):
                continue

            # Deduplicate: keep first source seen per absolute rule
            if abs_rule not in candidates:
                candidates[abs_rule] = rule

        # Second pass: filter out candidates covered by OTHER candidates with wildcards
        # (e.g., a specific script covered by a suggested /**/* wildcard)
        candidate_rules = set(candidates.keys())
        for abs_rule, source in candidates.items():
            if _is_covered_by(abs_rule, candidate_rules):
                continue
            missing.append({
                "ruleContent": abs_rule,
                "source": f"{tool}({source})",
                "tool": tool,
                "type": "missing_absolute",
            })

    return missing


def _aggregate_tool_blocks(tool_blocks: list[dict]) -> list[dict]:
    """Aggregate raw tool block entries into deduplicated results with counts."""
    aggregated: dict[str, dict] = {}

    for block in tool_blocks:
        tool = block["tool"]
        btype = block["type"]

        if btype == "setMode":
            key = f"{tool}:setMode:{block.get('mode', '')}"
            if key not in aggregated:
                aggregated[key] = {"tool": tool, "type": "setMode", "mode": block.get("mode", ""), "count": 0}
            aggregated[key]["count"] += 1

        elif btype == "addDirectories":
            dirs = tuple(sorted(block.get("directories", [])))
            key = f"{tool}:addDirectories:{dirs}"
            if key not in aggregated:
                aggregated[key] = {"tool": tool, "type": "addDirectories", "directories": list(dirs), "count": 0}
            aggregated[key]["count"] += 1

        elif btype == "noSuggestion":
            key = f"{tool}:noSuggestion"
            if key not in aggregated:
                aggregated[key] = {"tool": tool, "type": "noSuggestion", "count": 0}
            aggregated[key]["count"] += 1

        elif btype == "addRules":
            key = f"{tool}:addRules:{block.get('ruleContent', '')}"
            if key not in aggregated:
                aggregated[key] = {"tool": tool, "type": "addRules", "ruleContent": block.get("ruleContent", ""), "count": 0}
            aggregated[key]["count"] += 1

    # Sort by count descending
    return sorted(aggregated.values(), key=lambda x: x["count"], reverse=True)


def _parse_args() -> tuple:
    """Parse CLI arguments. Returns (session_ids_or_count, settings_file).

    Supported forms:
        detect-blocked-commands.py [num_sessions] [settings_file]
        detect-blocked-commands.py --session-id <id> [settings_file]
    """
    args = sys.argv[1:]
    session_id = None
    num_sessions = 10
    settings_file = Path(".claude/settings.local.json")

    i = 0
    while i < len(args):
        if args[i] == "--session-id" and i + 1 < len(args):
            session_id = args[i + 1]
            i += 2
        elif i == 0 and session_id is None:
            # First positional arg is num_sessions (if not using --session-id)
            try:
                num_sessions = int(args[i])
            except ValueError:
                pass
            i += 1
        else:
            # Remaining positional arg is settings_file
            settings_file = Path(args[i])
            i += 1

    return session_id, num_sessions, settings_file


def main():
    session_id, num_sessions, settings_file = _parse_args()

    home = Path.home()
    project_path = get_project_path()
    projects_dir = home / ".claude" / "projects" / f"-{project_path}"
    debug_dir = home / ".claude" / "debug"

    # Get session IDs
    if session_id:
        session_ids = [session_id]
    else:
        session_ids = get_recent_session_ids(projects_dir, num_sessions)

    # Load existing rules (grouped by tool)
    rules_by_tool = load_existing_rules(settings_file)
    bash_existing = rules_by_tool.get("Bash", set())

    if not session_ids:
        # No sessions to scan, but still check for missing absolute coverage
        cwd = os.getcwd()
        missing_absolute = find_missing_absolute_coverage(rules_by_tool, cwd)
        print(json.dumps({"blocked": [], "toolBlocks": [], "missingAbsolute": missing_absolute}, indent=2))
        return

    # Collect all blocked commands and tool blocks
    all_blocked = []
    all_tool_blocks = []
    for session_id in session_ids:
        debug_file = debug_dir / f"{session_id}.txt"
        bash_rules, tool_blocks = extract_blocked_commands(debug_file)
        all_blocked.extend(bash_rules)
        all_tool_blocks.extend(tool_blocks)

    # Count occurrences and filter out existing Bash rules
    counter = Counter(all_blocked)

    # Build prefix list from wildcard rules (e.g., "git -C:*" -> "git -C")
    wildcard_prefixes = []
    for rule in bash_existing:
        if rule.endswith(":*"):
            wildcard_prefixes.append(rule[:-2])  # Remove ":*" suffix

    results = []
    for rule_content, count in counter.most_common():
        if rule_content in bash_existing:
            continue
        # Check if the command matches any wildcard prefix
        if any(rule_content.startswith(prefix) for prefix in wildcard_prefixes):
            continue
        results.append({"ruleContent": rule_content, "count": count})

    # Aggregate tool blocks by (tool, type, mode/directories)
    tool_block_results = _aggregate_tool_blocks(all_tool_blocks)

    # Find relative path rules missing absolute coverage (all tools)
    cwd = os.getcwd()
    missing_absolute = find_missing_absolute_coverage(rules_by_tool, cwd)

    output = {
        "blocked": results,
        "toolBlocks": tool_block_results,
        "missingAbsolute": missing_absolute,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
