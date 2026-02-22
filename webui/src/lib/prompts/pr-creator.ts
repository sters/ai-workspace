/**
 * Prompt template for workspace-repo-create-or-update-pr agent.
 * Creates or updates a pull request for a repository.
 */

export interface PRCreatorInput {
  workspaceName: string;
  repoPath: string;
  repoName: string;
  baseBranch: string;
  worktreePath: string;
  readmeContent: string;
  repoChanges: string;
  draft: boolean;
  existingPR?: {
    url: string;
    title: string;
    body: string;
  };
}

export function buildPRCreatorPrompt(input: PRCreatorInput): string {
  const existingPRSection = input.existingPR
    ? `## Existing PR

**URL**: ${input.existingPR.url}
**Title**: ${input.existingPR.title}

**Body**:
${input.existingPR.body}
`
    : "";

  return `# Task: ${input.existingPR ? "Update" : "Create"} PR for ${input.repoName}

## Workspace: ${input.workspaceName}
## Repository: ${input.repoPath}
## Base Branch: ${input.baseBranch}
## Worktree: ${input.worktreePath}
## Draft: ${input.draft}

## Workspace README

${input.readmeContent}

## Repository Changes

${input.repoChanges}

${existingPRSection}

## Instructions

${PR_CREATOR_INSTRUCTIONS}
`;
}

const PR_CREATOR_INSTRUCTIONS = `You are a specialized agent for creating or updating a pull request for a repository.

**Your mission: Create or update a pull request based on the changes and context above.**

### If Creating a New PR

1. **Find PR Template**:
   - Look for \`.github/pull_request_template.md\` or \`.github/PULL_REQUEST_TEMPLATE.md\`
   - If no template found, use a standard format

2. **Compose PR Content**:
   - Title: concise, under 70 characters
   - Fill in PR template with change information
   - Include ticket URLs in "Related issues" section

3. **Push and Create**:
   - Push the branch to remote: \`git push -u origin <branch>\`
   - Create PR using \`gh pr create\`
   - Use \`--draft\` flag if Draft is true

### If Updating an Existing PR

1. **Use Existing PR Body** as the template
2. **Overwrite** sections describing code changes with latest info
3. **Keep everything else unchanged** (QA results, review notes, etc.)
4. **Push** latest changes: \`git push\`
5. **Update** PR using \`gh pr edit\`

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

For git operations:
\`\`\`bash
git -C <worktree-path> push -u origin <branch>
\`\`\`

For gh operations, use \`--repo\` flag or run from the worktree:
\`\`\`bash
gh pr create --repo <owner/repo> ...
\`\`\`

### Guidelines

- Always use draft mode unless Draft is explicitly false
- Follow repository's PR template exactly if one exists
- Keep title concise (under 70 characters)
- Include all commits in summary, not just the latest
- Always include full ticket URLs (not just IDs)
`;
