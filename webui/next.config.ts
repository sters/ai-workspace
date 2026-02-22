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
  webpack: (config, context) => {
    if (context.isServer) {
      // Preserve Bun global in server bundles — webpack's minifier mangles bare
      // `Bun` references, but `globalThis.Bun` property access survives minification.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const webpack = require("webpack");
      config.plugins!.push(
        new webpack.DefinePlugin({ Bun: "globalThis.Bun" }),
      );
    }
    return config;
  },
};

export default nextConfig;
