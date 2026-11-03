import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export interface EditReport {
  duration_in: number;
  duration_out: number;
  removed_seconds: number;
  subtitles: boolean;
  transcript?: string;
  warnings: string[];
  segments: unknown;
}

function run(cmd: string, args: string[], timeoutMs = 30 * 60_000): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 1, stderr, stdout });
    });
  });
}

export function editScriptPath() {
  return env.editScript || path.resolve(process.cwd(), "tools/edit_reel.py");
}

/** Runs the auto-editor (silence cut, Whisper subtitles, 9:16) and returns its report. */
export async function editReel(
  input: string,
  outDir: string,
  opts: { lang: string; trimStart?: number; trimEnd?: number; noSubtitles?: boolean; srt?: string },
): Promise<EditReport> {
  const args = [
    editScriptPath(), input, "--out", outDir, "--lang", opts.lang,
    "--model", env.whisperModel, "--font", env.subtitleFont,
  ];
  if (opts.noSubtitles) args.push("--no-subs");
  if (opts.srt) args.push("--srt", opts.srt);
  if (opts.trimStart) args.push("--trim-start", String(opts.trimStart));
  if (opts.trimEnd) args.push("--trim-end", String(opts.trimEnd));
  const r = await run(env.pythonBin, ["-I", ...args]);
  if (r.code !== 0) throw new Error(`edit_reel failed: ${r.stderr.slice(-1500)}`);
  return JSON.parse(await readFile(path.join(outDir, "report.json"), "utf8")) as EditReport;
}

export async function extractFrame(video: string, second: number, out: string) {
  const r = await run("ffmpeg", ["-y", "-v", "error", "-ss", String(second), "-i", video, "-frames:v", "1", "-q:v", "3", out], 120_000);
  if (r.code !== 0) throw new Error(`ffmpeg frame failed: ${r.stderr.slice(-500)}`);
}

/** Maps the brand's language description to a Whisper language code. */
export function whisperLang(language: string) {
  const l = language.toLowerCase();
  if (/arab|عرب|لبنان|leban|leva|egypt|gulf|خليج/.test(l)) return "ar";
  if (/fran|french|fr\b/.test(l)) return "fr";
  if (/span|españ/.test(l)) return "es";
  if (/portug/.test(l)) return "pt";
  if (/hindi/.test(l)) return "hi";
  return "en";
}
