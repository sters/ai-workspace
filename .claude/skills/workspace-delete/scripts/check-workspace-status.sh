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
# Check only workspace metadata files (README, TODO, reviews) - much faster than scanning all files
LAST_TIMESTAMP=0
LAST_FILE=""

for FILE in "$WORKSPACE_DIR"/README.md "$WORKSPACE_DIR"/TODO-*.md "$WORKSPACE_DIR"/reviews/*/*.md; do
    if [ -f "$FILE" ]; then
        # macOS uses -f "%m", Linux uses -c "%Y"
        TIMESTAMP=$(stat -f "%m" "$FILE" 2>/dev/null || stat -c "%Y" "$FILE" 2>/dev/null)
        if [ -n "$TIMESTAMP" ] && [ "$TIMESTAMP" -gt "$LAST_TIMESTAMP" ]; then
            LAST_TIMESTAMP=$TIMESTAMP
            LAST_FILE=$FILE
        fi
    fi
done

if [ "$LAST_TIMESTAMP" -gt 0 ]; then
    LAST_DATE=$(date -r "$LAST_TIMESTAMP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "@$LAST_TIMESTAMP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
    echo "Date: $LAST_DATE"
    echo "File: $LAST_FILE"
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
