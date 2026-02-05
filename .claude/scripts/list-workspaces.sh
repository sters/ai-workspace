#!/bin/bash
set -euo pipefail

# Usage: ./list-workspaces.sh
#
# Lists all workspace directories under workspace/.
#
# Returns: One workspace per line in format "workspace/<name>/"
# Exit code: 0 always (prints "No workspaces found" if empty)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKSPACE_DIR="$PROJECT_ROOT/workspace"

if [[ ! -d "$WORKSPACE_DIR" ]]; then
    echo "No workspaces found"
    exit 0
fi

workspaces=$(find "$WORKSPACE_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)

if [[ -z "$workspaces" ]]; then
    echo "No workspaces found"
    exit 0
fi

# Use sed instead of while loop + basename (faster)
echo "$workspaces" | sed 's|.*/|workspace/|;s|$|/|'
