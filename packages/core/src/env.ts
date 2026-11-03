/** Central runtime configuration (read lazily so tests can override process.env). */
export const env = {
  get aiProvider(): "anthropic" | "mock" {
    return process.env.AI_PROVIDER === "mock" ? "mock" : "anthropic";
  },
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get modelSmart() {
    return process.env.AI_MODEL_SMART || "claude-sonnet-5-5";
  },
  get modelFast() {
    return process.env.AI_MODEL_FAST || "claude-haiku-5-5";
  },
  get storageDriver(): "local" | "s3" {
    return process.env.STORAGE_DRIVER === "s3" ? "s3" : "local";
  },
  get storageDir() {
    return process.env.STORAGE_DIR || "./data/storage";
  },
  get pythonBin() {
    return process.env.PYTHON_BIN || "python3";
  },
  get whisperModel() {
    return process.env.WHISPER_MODEL || "small";
  },
  get subtitleFont() {
    return process.env.SUBTITLE_FONT || "Cairo";
  },
  get editScript() {
    return process.env.EDIT_REEL_SCRIPT || "";
  },
};
