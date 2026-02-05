#!/bin/bash
set -euo pipefail

# Usage: ./list-workspace-repos.sh <workspace-name>
# Example: ./list-workspace-repos.sh feature-auth-20260130
#
# Lists all repository worktrees in a workspace.
# Finds directories containing .git (regular repos or worktrees).
#
# Returns: Repository paths relative to workspace, one per line (e.g., "github.com/org/repo")
# Exit code: 0 on success, 1 if workspace not found

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <workspace-name>" >&2
    exit 1
fi

WORKSPACE_NAME="$1"
WORKSPACE_PATH="$PROJECT_ROOT/workspace/$WORKSPACE_NAME"

if [[ ! -d "$WORKSPACE_PATH" ]]; then
    echo "Workspace not found: $WORKSPACE_NAME" >&2
    exit 1
fi

# Find repository directories (directories containing .git or are git worktrees)
# Note: .git is a directory for regular repos, but a file for worktrees
# Use sed to strip /.git suffix and workspace prefix (faster than while loop + dirname)
find "$WORKSPACE_PATH" -mindepth 2 -maxdepth 4 -name ".git" 2>/dev/null | \
    sed 's|/\.git$||' | sed "s|^$WORKSPACE_PATH/||" | sort
