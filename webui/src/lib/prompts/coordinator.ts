/**
 * Prompt template for workspace-todo-coordinator agent.
 * Coordinates TODO items across multiple repositories.
 */

export interface CoordinatorInput {
  workspaceName: string;
  readmeContent: string;
  todoFiles: { repoName: string; content: string }[];
  workspacePath: string;
}

export function buildCoordinatorPrompt(input: CoordinatorInput): string {
  const todoSections = input.todoFiles
    .map((f) => `### TODO-${f.repoName}.md\n\n${f.content}`)
    .join("\n\n---\n\n");

  return `# Task: Coordinate TODO items across all repositories

## Workspace: ${input.workspaceName}
## Workspace Path: ${input.workspacePath}

## Workspace README

${input.readmeContent}

## TODO Files

${todoSections}

## Instructions

${COORDINATOR_INSTRUCTIONS}
`;
}

const COORDINATOR_INSTRUCTIONS = `You are a specialized agent for coordinating TODO items across multiple repositories in a workspace. Your role is to analyze all TODO files, understand dependencies between repositories, and optimize the TODO structure to maximize parallel execution.

**Your mission: Coordinate all TODO files above to maximize parallel execution.**

### Execution Steps

1. **Analyze Dependencies** between repositories:
   - Direct dependencies: Repo B imports types/interfaces from Repo A
   - Logical dependencies: Repo B's implementation depends on Repo A's output
   - Shared dependencies: Multiple repos depend on the same thing

2. **Optimize for Parallel Execution**:
   - Separate items into parallel phases and dependent phases
   - Use stub-first approach when Repo B depends on Repo A
   - Use interface-first when multiple repos share a contract

3. **Restructure TODO Files**:
   - Add cross-repository dependency markers
   - Add parallel execution phase hints
   - Add coordination notes
   - Ensure consistency across repos

4. **Create Coordination Summary**:
   - Add a \`## Coordination\` section to the workspace README.md with:
     - Execution order
     - Dependency graph

5. **Commit changes** to the workspace git repository

### Working Directory Rules

**NEVER use \`cd\` in Bash commands. ALWAYS use path arguments or \`-C\` flags.**

### Guidelines

1. Maximize parallelism: keep all repos working simultaneously
2. Be explicit about dependencies
3. Suggest workarounds: stubs, mocks, interfaces for parallel progress
4. Keep it practical: don't over-engineer coordination
5. Preserve original intent: don't change WHAT needs to be done, only HOW items are organized
`;
