#!/bin/bash
# Read PR template from repository
# Usage: read-pr-template.sh <repo-path>
# Output: Template content if found, empty if not found
# Exit code: 0 if found, 1 if not found

set -e

REPO_PATH="$1"

if [ -z "$REPO_PATH" ]; then
    echo "Error: Repository path is required" >&2
    echo "Usage: $0 <repo-path>" >&2
    exit 2
fi

if [ ! -d "$REPO_PATH" ]; then
    echo "Error: Repository path not found: $REPO_PATH" >&2
    exit 2
fi

cd "$REPO_PATH"

# Search for PR template (case-insensitive)
# Priority: .github > docs > root
TEMPLATE=$(find . -maxdepth 3 \( \
    -ipath "./.github/pull_request_template.md" -o \
    -ipath "./.github/pull_request_template/default.md" -o \
    -ipath "./docs/pull_request_template.md" -o \
    -ipath "./pull_request_template.md" \
    \) -type f 2>/dev/null | head -1)

if [ -n "$TEMPLATE" ]; then
    cat "$TEMPLATE"
    exit 0
fi

# No template found, use default
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_TEMPLATE="${SCRIPT_DIR}/../templates/default-pr-template.md"

if [ -f "$DEFAULT_TEMPLATE" ]; then
    cat "$DEFAULT_TEMPLATE"
    exit 0
fi

# Fallback if default template is missing
echo "Error: Default template not found: $DEFAULT_TEMPLATE" >&2
exit 1
