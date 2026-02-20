#!/usr/bin/env node

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(__dirname, "..");

// Resolve AI_WORKSPACE_ROOT: args > env > cwd
let root = process.argv[2] || process.env.AI_WORKSPACE_ROOT || process.cwd();
root = resolve(root);

const workspaceDir = resolve(root, "workspace");
if (!existsSync(workspaceDir)) {
  console.error(`Error: workspace/ directory not found at ${root}`);
  console.error("Make sure you run this from the ai-workspace root directory,");
  console.error("or pass the path as an argument: ai-workspace-ui /path/to/ai-workspace");
  process.exit(1);
}

console.log(`ai-workspace root: ${root}`);
console.log(`Starting on http://localhost:3741`);

const isDev = process.argv.includes("--dev");
const cmd = isDev ? "dev" : "start";

// For production mode, build first if needed
if (!isDev && !existsSync(resolve(packageDir, ".next"))) {
  console.log("Building...");
  execSync("bun run build", { cwd: packageDir, stdio: "inherit" });
}

const child = spawn("bun", ["run", cmd], {
  cwd: packageDir,
  stdio: "inherit",
  env: {
    ...process.env,
    AI_WORKSPACE_ROOT: root,
    PORT: "3741",
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
