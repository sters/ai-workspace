#!/bin/bash
# List stale workspaces (not modified within specified days)
# Usage: list-stale-workspaces.sh [days]
# Default: 7 days

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)/workspace"
DAYS="${1:-7}"

if [[ ! -d "$WORKSPACE_DIR" ]]; then
    echo "No workspaces found"
    exit 0
fi

# Use find with -mtime for speed (directories modified more than N days ago)
# Use -print0 and xargs -0 to handle special characters and batch stat calls
stale_output=$(find "$WORKSPACE_DIR" -maxdepth 1 -mindepth 1 -type d -mtime +"$DAYS" -print0 2>/dev/null | \
    xargs -0 stat -f "%N (%Sm)" -t "%Y-%m-%d" 2>/dev/null | \
    sed 's|.*/\([^/]*\) (|workspace/\1/ (|' | sort)

if [[ -z "$stale_output" ]]; then
    echo "No stale workspaces found (threshold: $DAYS days)"
    exit 0
fi

echo "$stale_output"
