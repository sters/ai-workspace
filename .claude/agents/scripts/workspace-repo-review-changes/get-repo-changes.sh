#!/bin/bash
# Get repository changes (for review and PR creation)
# Usage: get-repo-changes.sh <workspace-name> <repository-path> <base-branch>
# Output: Branch info, changed files, diff stats, commit log

set -e

WORKSPACE_NAME="$1"
REPO_PATH="$2"
BASE_BRANCH="$3"

if [ -z "$WORKSPACE_NAME" ] || [ -z "$REPO_PATH" ] || [ -z "$BASE_BRANCH" ]; then
    echo "Error: Workspace name, repository path, and base branch are required" >&2
    echo "Usage: $0 <workspace-name> <repository-path> <base-branch>" >&2
    exit 1
fi

WORKTREE_PATH="workspace/${WORKSPACE_NAME}/${REPO_PATH}"

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "Error: Repository worktree not found: $WORKTREE_PATH" >&2
    exit 1
fi

cd "$WORKTREE_PATH"

# Fetch latest
git fetch origin "$BASE_BRANCH" 2>/dev/null || git fetch origin 2>/dev/null || true

echo "=== CURRENT BRANCH ==="
git branch --show-current

echo ""
echo "=== CHANGED FILES ==="
git diff --name-status "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no changes)"

echo ""
echo "=== DIFF STAT ==="
# --stat includes summary line, so --shortstat is redundant
git diff --stat "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no changes)"

echo ""
echo "=== COMMIT LOG ==="
git log --oneline "origin/${BASE_BRANCH}...HEAD" 2>/dev/null || echo "(no commits)"
