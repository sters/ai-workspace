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

for TODO_FILE in "$WORKSPACE_DIR"/TODO-*.md; do
    if [ -f "$TODO_FILE" ]; then
        FILENAME=$(basename "$TODO_FILE")
        COMPLETED=$(grep -c '^\s*- \[x\]' "$TODO_FILE" 2>/dev/null || echo "0")
        INCOMPLETE=$(grep -c '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null || echo "0")
        TOTAL=$((COMPLETED + INCOMPLETE))

        TOTAL_COMPLETED=$((TOTAL_COMPLETED + COMPLETED))
        TOTAL_INCOMPLETE=$((TOTAL_INCOMPLETE + INCOMPLETE))

        if [ "$TOTAL" -gt 0 ]; then
            PROGRESS=$((COMPLETED * 100 / TOTAL))
        else
            PROGRESS=0
        fi

        echo "### $FILENAME"
        echo "- Completed: $COMPLETED"
        echo "- Incomplete: $INCOMPLETE"
        echo "- Progress: ${PROGRESS}%"

        if [ "$INCOMPLETE" -gt 0 ]; then
            echo ""
            echo "Incomplete items:"
            if [ "$INCOMPLETE" -le 5 ]; then
                grep '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null || true
            else
                grep '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null | head -5 || true
                echo "  ... and $((INCOMPLETE - 5)) more"
            fi
        fi
        echo ""
    fi
done

if [ "$TOTAL_COMPLETED" -eq 0 ] && [ "$TOTAL_INCOMPLETE" -eq 0 ]; then
    echo "No TODO files found"
    echo ""
fi

GRAND_TOTAL=$((TOTAL_COMPLETED + TOTAL_INCOMPLETE))
if [ "$GRAND_TOTAL" -gt 0 ]; then
    OVERALL_PROGRESS=$((TOTAL_COMPLETED * 100 / GRAND_TOTAL))
    echo "## Overall"
    echo "- Total Completed: $TOTAL_COMPLETED"
    echo "- Total Incomplete: $TOTAL_INCOMPLETE"
    echo "- Overall Progress: ${OVERALL_PROGRESS}%"
fi
