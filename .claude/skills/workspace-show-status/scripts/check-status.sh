#!/bin/bash
# Check workspace TODO progress
# Usage: check-status.sh <workspace-name>

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

echo "## Current Workspace"
echo "$WORKSPACE_DIR/"
echo ""

echo "## TODO Progress"

TOTAL_COMPLETED=0
TOTAL_INCOMPLETE=0
TOTAL_BLOCKED=0
TOTAL_IN_PROGRESS=0

for TODO_FILE in "$WORKSPACE_DIR"/TODO-*.md; do
    if [ -f "$TODO_FILE" ]; then
        FILENAME=$(basename "$TODO_FILE")

        # Use awk to count all status types in one pass
        eval "$(awk '
            /^[[:space:]]*- \[x\]/ { completed++ }
            /^[[:space:]]*- \[ \]/ { incomplete++ }
            /^[[:space:]]*- \[!\]/ { blocked++ }
            /^[[:space:]]*- \[~\]/ { in_progress++ }
            END {
                print "COMPLETED=" completed+0
                print "INCOMPLETE=" incomplete+0
                print "BLOCKED=" blocked+0
                print "IN_PROGRESS=" in_progress+0
            }
        ' "$TODO_FILE")"

        TOTAL=$((COMPLETED + INCOMPLETE + BLOCKED + IN_PROGRESS))
        TOTAL_COMPLETED=$((TOTAL_COMPLETED + COMPLETED))
        TOTAL_INCOMPLETE=$((TOTAL_INCOMPLETE + INCOMPLETE))
        TOTAL_BLOCKED=$((TOTAL_BLOCKED + BLOCKED))
        TOTAL_IN_PROGRESS=$((TOTAL_IN_PROGRESS + IN_PROGRESS))

        if [ "$TOTAL" -gt 0 ]; then
            PROGRESS=$((COMPLETED * 100 / TOTAL))
        else
            PROGRESS=0
        fi

        echo "### $FILENAME"
        echo "- Completed: $COMPLETED"
        echo "- Incomplete: $INCOMPLETE"
        echo "- In Progress: $IN_PROGRESS"
        echo "- Blocked: $BLOCKED"
        echo "- Progress: ${PROGRESS}%"

        if [ "$BLOCKED" -gt 0 ]; then
            echo ""
            echo "Blocked items:"
            grep '^[[:space:]]*- \[!\]' "$TODO_FILE" 2>/dev/null || true
        fi

        if [ "$IN_PROGRESS" -gt 0 ]; then
            echo ""
            echo "In-progress items:"
            grep '^[[:space:]]*- \[~\]' "$TODO_FILE" 2>/dev/null || true
        fi

        if [ "$INCOMPLETE" -gt 0 ]; then
            echo ""
            echo "Incomplete items:"
            if [ "$INCOMPLETE" -le 5 ]; then
                grep '^[[:space:]]*- \[ \]' "$TODO_FILE" 2>/dev/null || true
            else
                grep '^[[:space:]]*- \[ \]' "$TODO_FILE" 2>/dev/null | head -5 || true
                echo "  ... and $((INCOMPLETE - 5)) more"
            fi
        fi
        echo ""
    fi
done

if [ "$TOTAL_COMPLETED" -eq 0 ] && [ "$TOTAL_INCOMPLETE" -eq 0 ] && [ "$TOTAL_BLOCKED" -eq 0 ] && [ "$TOTAL_IN_PROGRESS" -eq 0 ]; then
    echo "No TODO files found"
    echo ""
fi

GRAND_TOTAL=$((TOTAL_COMPLETED + TOTAL_INCOMPLETE + TOTAL_BLOCKED + TOTAL_IN_PROGRESS))
if [ "$GRAND_TOTAL" -gt 0 ]; then
    OVERALL_PROGRESS=$((TOTAL_COMPLETED * 100 / GRAND_TOTAL))
    echo "## Overall"
    echo "- Total Completed: $TOTAL_COMPLETED"
    echo "- Total Incomplete: $TOTAL_INCOMPLETE"
    echo "- Total In Progress: $TOTAL_IN_PROGRESS"
    echo "- Total Blocked: $TOTAL_BLOCKED"
    echo "- Overall Progress: ${OVERALL_PROGRESS}%"
fi
