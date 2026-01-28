#!/bin/bash
# Check workspace status before deletion
# Usage: check-workspace-status.sh <workspace-name>
# Output: Workspace status information (last modified, TODO counts)

set -e

WORKSPACE_NAME="$1"

if [ -z "$WORKSPACE_NAME" ]; then
    echo "Error: Workspace name is required" >&2
    echo "Usage: $0 <workspace-name>" >&2
    exit 1
fi

WORKSPACE_DIR="workspace/${WORKSPACE_NAME}"

if [ ! -d "$WORKSPACE_DIR" ]; then
    echo "Error: Workspace directory not found: $WORKSPACE_DIR" >&2
    exit 1
fi

echo "=== LAST ACTIVITY ==="
# Find most recently modified file (macOS compatible)
LAST_MODIFIED=$(find "$WORKSPACE_DIR" -type f -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1)
if [ -n "$LAST_MODIFIED" ]; then
    TIMESTAMP=$(echo "$LAST_MODIFIED" | awk '{print $1}')
    FILEPATH=$(echo "$LAST_MODIFIED" | cut -d' ' -f2-)
    # Convert timestamp to readable date (macOS)
    LAST_DATE=$(date -r "$TIMESTAMP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "@$TIMESTAMP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
    echo "Date: $LAST_DATE"
    echo "File: $FILEPATH"
else
    echo "Date: Unknown"
    echo "File: None"
fi

echo ""
echo "=== TODO STATUS ==="
for TODO_FILE in "$WORKSPACE_DIR"/TODO-*.md; do
    if [ -f "$TODO_FILE" ]; then
        FILENAME=$(basename "$TODO_FILE")
        COMPLETED=$(grep -c '^\s*- \[x\]' "$TODO_FILE" 2>/dev/null || echo "0")
        INCOMPLETE=$(grep -c '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null || echo "0")

        echo "File: $FILENAME"
        echo "Completed: $COMPLETED"
        echo "Incomplete: $INCOMPLETE"

        if [ "$INCOMPLETE" -gt 0 ]; then
            echo "Incomplete items:"
            if [ "$INCOMPLETE" -le 5 ]; then
                grep '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null || true
            else
                grep '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null | head -5 || true
                echo "  ... and $((INCOMPLETE - 5)) more items"
            fi
        fi
        echo ""
    fi
done
