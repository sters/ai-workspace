#!/usr/bin/env python3
"""
detect-blocked-commands.py - Extract blocked Bash commands from Claude Code debug logs

Usage: detect-blocked-commands.py [num_sessions] [settings_file]
       detect-blocked-commands.py --session-id <session-id> [settings_file]
Output: JSON object with two keys:
  - "blocked": array of blocked commands not already in settings
  - "missingAbsolute": array of relative path rules lacking absolute path coverage

The script:
1. Lists recent session .jsonl files by modification time
2. Extracts session IDs and checks corresponding debug files
3. Parses debug files for permission denied events with addRules suggestions
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


def load_existing_rules(settings_file: Path) -> set[str]:
    """Load existing Bash rules from settings.local.json."""
    if not settings_file.exists():
        return set()

    try:
        with open(settings_file) as f:
            settings = json.load(f)

        rules = set()
        for rule in settings.get("permissions", {}).get("allow", []):
            # Extract rule content from "Bash(content)" format
            if rule.startswith("Bash(") and rule.endswith(")"):
                content = rule[5:-1]  # Remove "Bash(" and ")"
                rules.add(content)
        return rules
    except (json.JSONDecodeError, OSError):
        return set()


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
    """Extract Bash ruleContent values from parsed suggestions."""
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


# Max lines to look ahead for "Bash tool permission denied" after a suggestion
_DENIED_LOOKAHEAD = 15


def extract_blocked_commands(debug_file: Path) -> list[str]:
    """Extract blocked Bash command rules from a debug log file."""
    if not debug_file.exists():
        return []

    blocked_commands = []

    try:
        with open(debug_file, encoding="utf-8", errors="replace") as f:
            content = f.read()

        lines = content.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i]
            if "Permission suggestions for Bash:" not in line:
                i += 1
                continue

            # Extract the JSON portion after the marker
            marker = "Permission suggestions for Bash: "
            json_start = line.find(marker) + len(marker)
            json_str = line[json_start:].strip()

            # Collect additional lines if the JSON spans multiple lines
            j = i + 1
            if not json_str.rstrip().rstrip('"').endswith("]"):
                while j < len(lines) and not json_str.rstrip().endswith("]"):
                    json_str += "\n" + lines[j]
                    j += 1

            # Look ahead (up to _DENIED_LOOKAHEAD lines) for permission denied
            is_denied = False
            for k in range(j, min(j + _DENIED_LOOKAHEAD, len(lines))):
                if "Bash tool permission denied" in lines[k]:
                    is_denied = True
                    break
                # Stop early if we hit the next permission suggestion
                if "Permission suggestions for Bash:" in lines[k]:
                    break

            if is_denied:
                suggestions = _parse_suggestions_json(json_str)
                blocked_commands.extend(_extract_rule_contents(suggestions))

            i = j
    except OSError:
        return []

    return blocked_commands


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


def find_missing_absolute_coverage(existing_rules: set[str], cwd: str) -> list[dict]:
    """Find relative path rules that lack corresponding absolute path coverage."""
    # Collect all existing absolute rules for coverage checks
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
    missing = []
    for abs_rule, source in candidates.items():
        if _is_covered_by(abs_rule, candidate_rules):
            continue
        missing.append({
            "ruleContent": abs_rule,
            "source": f"Bash({source})",
            "type": "missing_absolute",
        })

    return missing


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

    # Load existing rules
    existing_rules = load_existing_rules(settings_file)

    if not session_ids:
        # No sessions to scan, but still check for missing absolute coverage
        cwd = os.getcwd()
        missing_absolute = find_missing_absolute_coverage(existing_rules, cwd)
        print(json.dumps({"blocked": [], "missingAbsolute": missing_absolute}, indent=2))
        return

    # Collect all blocked commands
    all_blocked = []
    for session_id in session_ids:
        debug_file = debug_dir / f"{session_id}.txt"
        blocked = extract_blocked_commands(debug_file)
        all_blocked.extend(blocked)

    # Count occurrences and filter out existing rules
    counter = Counter(all_blocked)

    # Build prefix list from wildcard rules (e.g., "git -C:*" -> "git -C")
    wildcard_prefixes = []
    for rule in existing_rules:
        if rule.endswith(":*"):
            wildcard_prefixes.append(rule[:-2])  # Remove ":*" suffix

    results = []
    for rule_content, count in counter.most_common():
        if rule_content in existing_rules:
            continue
        # Check if the command matches any wildcard prefix
        if any(rule_content.startswith(prefix) for prefix in wildcard_prefixes):
            continue
        results.append({"ruleContent": rule_content, "count": count})

    # Find relative path rules missing absolute coverage
    cwd = os.getcwd()
    missing_absolute = find_missing_absolute_coverage(existing_rules, cwd)

    output = {
        "blocked": results,
        "missingAbsolute": missing_absolute,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
