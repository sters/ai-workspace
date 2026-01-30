#!/bin/bash
# Get repository changes (for review and PR creation)
# Usage: get-repo-changes.sh <repo-path> <base-branch>
# Output: Branch info, changed files, diff stats, commit log

set -e

REPO_PATH="$1"
BASE_BRANCH="$2"

if [ -z "$REPO_PATH" ] || [ -z "$BASE_BRANCH" ]; then
    echo "Error: Repository path and base branch are required" >&2
    echo "Usage: $0 <repo-path> <base-branch>" >&2
    exit 1
fi

if [ ! -d "$REPO_PATH" ]; then
    echo "Error: Repository path not found: $REPO_PATH" >&2
    exit 1
fi

cd "$REPO_PATH"

# Fetch latest
git fetch origin "$BASE_BRANCH" 2>/dev/null || git fetch origin 2>/dev/null || true

echo "=== CURRENT BRANCH ==="
git branch --show-current

echo ""
echo "=== CHANGED FILES ==="
git diff --name-status "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no changes)"

echo ""
echo "=== DIFF STAT ==="
git diff --stat "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no changes)"

echo ""
echo "=== DIFF SUMMARY ==="
git diff --shortstat "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no changes)"

echo ""
echo "=== COMMIT LOG ==="
git log --oneline "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no commits)"
