#!/bin/bash

set -e

# Usage: ./setup-workspace.sh <task-type> <description> [ticket-id]
# Example: ./setup-workspace.sh feature user-auth
# Example: ./setup-workspace.sh bugfix login-error PROJ-123
#
# This script creates a workspace directory only. Use setup-repository.sh to add repositories.

TASK_TYPE="$1"
DESCRIPTION="$2"
TICKET_ID="$3"

# Strip ticket ID from description if it's already provided as a separate argument
# This prevents duplicate ticket IDs like "feature-CC-1234-cc-1234-description-20260209"
if [ -n "$TICKET_ID" ]; then
    # Convert both to lowercase for case-insensitive matching
    TICKET_LOWER=$(echo "$TICKET_ID" | tr '[:upper:]' '[:lower:]')
    # Work on lowercase description, then apply the same removal to the original
    DESC_LOWER=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]')
    # Remove ticket ID from: beginning (cc-1234-xxx), middle (xxx-cc-1234-xxx), end (xxx-cc-1234), or exact match
    DESC_CLEANED=$(echo "$DESC_LOWER" | sed -E "s/^${TICKET_LOWER}-//; s/-${TICKET_LOWER}-/-/; s/-${TICKET_LOWER}$//; s/^${TICKET_LOWER}$//")
    # Remove leading/trailing dashes that may remain
    DESC_CLEANED=$(echo "$DESC_CLEANED" | sed -E 's/^-+//; s/-+$//')
    if [ -n "$DESC_CLEANED" ]; then
        DESCRIPTION="$DESC_CLEANED"
    fi
fi

if [ -z "$TASK_TYPE" ] || [ -z "$DESCRIPTION" ]; then
    echo "Usage: $0 <task-type> <description> [ticket-id]"
    echo "Example: $0 feature user-auth"
    echo "Example: $0 bugfix login-error PROJ-123"
    echo ""
    echo "This creates a workspace directory. Use setup-repository.sh to add repositories."
    exit 1
fi

# Get the script directory and workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
WORKSPACE_DIR="$WORKSPACE_ROOT/workspace"

# Ensure settings.local.json exists
CLAUDE_DIR="$WORKSPACE_ROOT/.claude"
if [ ! -f "$CLAUDE_DIR/settings.local.json" ] && [ -f "$CLAUDE_DIR/settings.local.json.example" ]; then
    echo "==> Copying settings.local.json.example to settings.local.json..."
    cp "$CLAUDE_DIR/settings.local.json.example" "$CLAUDE_DIR/settings.local.json"
    echo "Created: $CLAUDE_DIR/settings.local.json"
fi

# Create working directory name
DATE=$(date +%Y%m%d)
if [ -n "$TICKET_ID" ]; then
    WORKING_DIR_NAME="${TASK_TYPE}-${TICKET_ID}-${DESCRIPTION}-${DATE}"
else
    WORKING_DIR_NAME="${TASK_TYPE}-${DESCRIPTION}-${DATE}"
fi

WORKING_DIR="$WORKSPACE_DIR/$WORKING_DIR_NAME"

echo "==> Setting up workspace: $WORKING_DIR_NAME"

# Step 1: Create working directory
echo "==> Creating working directory..."
mkdir -p "$WORKING_DIR"
echo "Created: $WORKING_DIR"

# Step 2: Create tmp and artifacts directories
echo "==> Creating tmp directory..."
mkdir -p "$WORKING_DIR/tmp"
echo "Created: $WORKING_DIR/tmp"

echo "==> Creating artifacts directory..."
mkdir -p "$WORKING_DIR/artifacts"
touch "$WORKING_DIR/artifacts/.gitkeep"
echo "Created: $WORKING_DIR/artifacts"

# Step 3: Initialize git repository for workspace tracking
echo "==> Initializing git repository for workspace tracking..."
cd "$WORKING_DIR"
git init --quiet

# Create .gitignore to exclude worktrees and tmp
cat > .gitignore << 'GITIGNORE'
# Exclude repository worktrees (they are separate git repos)
github.com/
gitlab.com/
bitbucket.org/

# Exclude temporary files
tmp/
*.tmp
*.log
GITIGNORE

echo "Git repository initialized with .gitignore"

# Templates directory (one level up from scripts/)
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

# Step 4: Create README.md from template
echo "==> Creating README.md..."
sed -e "s/{{DESCRIPTION}}/${DESCRIPTION}/g" \
    -e "s/{{TASK_TYPE}}/${TASK_TYPE}/g" \
    -e "s/{{TICKET_ID}}/${TICKET_ID:-N\/A}/g" \
    -e "s/{{DATE}}/$(date +%Y-%m-%d)/g" \
    "$TEMPLATES_DIR/README.md" > "$WORKING_DIR/README.md"
echo "Created: $WORKING_DIR/README.md"

# Step 5: Create initial git commit for workspace tracking
echo "==> Creating initial git commit..."
cd "$WORKING_DIR"
git add .gitignore README.md artifacts/
git commit --quiet -m "Initial: $WORKING_DIR_NAME workspace created"
echo "Initial commit created"

echo ""
echo "==> Workspace setup complete!"
echo "Working directory: $WORKING_DIR"
echo ""
echo "Next steps:"
echo "1. Add repositories using setup-repository.sh:"
echo "   ./setup-repository.sh $WORKING_DIR <org/repo-path>"
echo "2. Update README.md with task details"
echo "3. Run workspace-repo-todo-planner to create TODO items"
echo "4. Run workspace-todo-coordinator to optimize for parallel execution"
