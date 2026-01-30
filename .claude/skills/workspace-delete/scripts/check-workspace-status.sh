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
LAST_MODIFIED=$(find "$WORKSPACE_DIR" -type f -not -path "*/.git/*" -print0 2>/dev/null | xargs -0 stat -f "%m %N" 2>/dev/null | sort -rn | head -1)
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
        echo "File: $FILENAME"
        awk '
            /^[[:space:]]*- \[x\]/ { completed++ }
            /^[[:space:]]*- \[ \]/ { incomplete++; if (incomplete <= 5) items[incomplete] = $0 }
            END {
                print "Completed:", completed+0
                print "Incomplete:", incomplete+0
                if (incomplete > 0) {
                    print "Incomplete items:"
                    limit = (incomplete < 5) ? incomplete : 5
                    for (i = 1; i <= limit; i++) print items[i]
                    if (incomplete > 5) print "  ... and " (incomplete - 5) " more items"
                }
            }
        ' "$TODO_FILE"
        echo ""
    fi
done
