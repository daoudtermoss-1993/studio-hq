import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  transpilePackages: ["@studio/core", "@studio/db"],
  serverExternalPackages: ["pg", "@aws-sdk/client-s3", "@aws-sdk/lib-storage", "@anthropic-ai/sdk"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
