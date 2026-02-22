import type { NextConfig } from "next";

function getGitHash(): string {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"]);
    return result.success ? result.stdout.toString().trim() : "unknown";
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  env: {
    NEXT_PUBLIC_GIT_HASH: getGitHash(),
  },
};

export default nextConfig;
