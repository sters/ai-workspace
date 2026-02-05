#!/bin/bash
# List all review files in a review directory
# Usage: list-review-files.sh <workspace-name> <timestamp>
# Output: JSON with categorized file lists
#
# Output format:
# {
#   "review_dir": "workspace/.../reviews/...",
#   "code_reviews": ["file1.md", "file2.md"],
#   "todo_verifications": ["TODO-VERIFY_file1.md", "TODO-VERIFY_file2.md"]
# }

set -e

WORKSPACE_NAME="$1"
TIMESTAMP="$2"

if [ -z "$WORKSPACE_NAME" ] || [ -z "$TIMESTAMP" ]; then
    echo "Error: Workspace name and timestamp are required" >&2
    echo "Usage: $0 <workspace-name> <timestamp>" >&2
    exit 1
fi

REVIEW_DIR="workspace/${WORKSPACE_NAME}/reviews/${TIMESTAMP}"

if [ ! -d "$REVIEW_DIR" ]; then
    echo "Error: Review directory not found: $REVIEW_DIR" >&2
    exit 1
fi

# Find all .md files, exclude SUMMARY.md
CODE_REVIEWS=()
TODO_VERIFICATIONS=()

for file in "$REVIEW_DIR"/*.md; do
    [ -f "$file" ] || continue
    filename=$(basename "$file")

    # Skip SUMMARY.md
    [ "$filename" = "SUMMARY.md" ] && continue

    if [[ "$filename" == REVIEW-* ]]; then
        CODE_REVIEWS+=("$filename")
    elif [[ "$filename" == TODO-VERIFY-* ]]; then
        TODO_VERIFICATIONS+=("$filename")
    fi
    # Skip unknown files
done

# Output as JSON
echo "{"
echo "  \"review_dir\": \"$REVIEW_DIR\","

# Code reviews array
echo -n "  \"code_reviews\": ["
first=true
for f in "${CODE_REVIEWS[@]}"; do
    if [ "$first" = true ]; then
        first=false
    else
        echo -n ", "
    fi
    echo -n "\"$f\""
done
echo "],"

# TODO verifications array
echo -n "  \"todo_verifications\": ["
first=true
for f in "${TODO_VERIFICATIONS[@]}"; do
    if [ "$first" = true ]; then
        first=false
    else
        echo -n ", "
    fi
    echo -n "\"$f\""
done
echo "]"

echo "}"
