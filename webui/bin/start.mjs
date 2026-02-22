#!/usr/bin/env node

import { existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(__dirname, "..");

// Resolve AI_WORKSPACE_ROOT: args > env > cwd
let root = process.argv[2] || process.env.AI_WORKSPACE_ROOT || process.cwd();
root = resolve(root);

const workspaceDir = resolve(root, "workspace");
const repositoriesDir = resolve(root, "repositories");

const missingDirs = [];
if (!existsSync(workspaceDir)) missingDirs.push(workspaceDir);
if (!existsSync(repositoriesDir)) missingDirs.push(repositoriesDir);

if (missingDirs.length > 0) {
  console.log(`The following directories do not exist under ${root}:`);
  for (const dir of missingDirs) {
    console.log(`  - ${dir}`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question("Create them? [y/N] ", resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(1);
  }

  for (const dir of missingDirs) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created: ${dir}`);
  }
}

console.log(`ai-workspace root: ${root}`);
console.log(`Starting on http://localhost:3741`);

const isDev = process.argv.includes("--dev");
const cmd = isDev ? "dev" : "start";

// For production mode, build first if needed
if (!isDev && !existsSync(resolve(packageDir, ".next"))) {
  console.log("Building...");
  Bun.spawnSync(["bun", "run", "build"], {
    cwd: packageDir,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
}

const child = Bun.spawn(["bun", "run", cmd], {
  cwd: packageDir,
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
  env: {
    ...process.env,
    AI_WORKSPACE_ROOT: root,
    PORT: "3741",
  },
});

process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
await child.exited.then((code) => process.exit(code ?? 0));
