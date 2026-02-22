import path from "node:path";

function resolveRoot(): string {
  if (process.env.AI_WORKSPACE_ROOT) {
    return process.env.AI_WORKSPACE_ROOT;
  }
  // Default: assume webui/ is inside the ai-workspace root
  return path.resolve(process.cwd(), "..");
}

export const AI_WORKSPACE_ROOT = resolveRoot();
export const WORKSPACE_DIR = path.join(AI_WORKSPACE_ROOT, "workspace");

export function resolveWorkspaceName(input: string): string {
  if (path.isAbsolute(input)) {
    return path.basename(input);
  }
  return input;
}
