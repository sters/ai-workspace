#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
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

while IFS= read -r ws; do
    echo "workspace/$(basename "$ws")/"
done <<< "$workspaces"
