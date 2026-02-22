/**
 * Prompt template for the init operation's README editing phase.
 * Claude fills in the workspace README.md with task details.
 */

export interface InitReadmeInput {
  workspaceName: string;
  workspacePath: string;
  readmeContent: string;
  description: string;
  repos: { repoPath: string; repoName: string; baseBranch: string; branchName: string }[];
}

export function buildInitReadmePrompt(input: InitReadmeInput): string {
  const repoList = input.repos
    .map(
      (r) =>
        `- **${r.repoName}**: \`${r.repoPath}\` (base: \`${r.baseBranch}\`, branch: \`${r.branchName}\`)`,
    )
    .join("\n");

  return `# Task: Fill in workspace README

## Workspace: ${input.workspaceName}
## Workspace Path: ${input.workspacePath}

## User's Description

${input.description}

## Repositories

${repoList}

## Current README.md

${input.readmeContent}

## Instructions

You are setting up a new workspace. The README.md above is a template that needs to be filled in with task details.

Your job:
1. Read the user's description above
2. Edit the README.md file at \`${input.workspacePath}/README.md\` to fill in:
   - Update the Repositories section with the actual repositories listed above
   - Fill in Objective, Context, Requirements, and Related Resources based on the user's description
   - If the description is a ticket URL, fetch it and extract details
   - If the task type is research/investigation, note that in the README
3. If no repositories were specified above, you MUST identify the target repositories from the description and add them to the Repositories section. Use the format: \`| \`github.com/org/repo\` | Description | \`main\` |\`. If you cannot determine the target repositories from the description, use AskUserQuestion to ask the user which repositories to work on.
4. If anything else is unclear, use AskUserQuestion to ask the user

### Important Notes
- Use the file path \`${input.workspacePath}/README.md\` for edits
- Keep the template structure, just fill in the placeholder sections
- The README should give clear context for agents that will work on this task later
`;
}
