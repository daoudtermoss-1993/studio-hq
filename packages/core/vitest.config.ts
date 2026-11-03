import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio_test",
      AI_PROVIDER: "mock",
      STORAGE_DRIVER: "local",
      STORAGE_DIR: path.resolve(__dirname, "../../data/test-storage"),
      EDIT_REEL_SCRIPT: path.resolve(__dirname, "../../apps/worker/tools/edit_reel.py"),
      SUBTITLE_FONT: "DejaVu Sans",
    },
  },
});
