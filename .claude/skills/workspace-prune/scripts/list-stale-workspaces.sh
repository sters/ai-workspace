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
stale=$(find "$WORKSPACE_DIR" -maxdepth 1 -mindepth 1 -type d -mtime +"$DAYS" 2>/dev/null | sort)

if [[ -z "$stale" ]]; then
    echo "No stale workspaces found (threshold: $DAYS days)"
    exit 0
fi

while IFS= read -r ws; do
    ws_name=$(basename "$ws")
    mtime=$(stat -f "%m" "$ws" 2>/dev/null)
    last_date=$(date -r "$mtime" "+%Y-%m-%d" 2>/dev/null || echo "Unknown")
    echo "workspace/$ws_name/ ($last_date)"
done <<< "$stale"
