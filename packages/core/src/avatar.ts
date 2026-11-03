import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { copyFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { BrandProfile } from "@studio/db";
import { env } from "./env";

/**
 * Digital-twin video generation behind one small interface, so the provider can change later.
 * "heygen": HeyGen API (custom avatar + cloned voice created once in the HeyGen dashboard).
 * "mock":   local ffmpeg placeholder for demos and tests.
 */
export interface AvatarStart {
  provider: string;
  jobId: string;
}
export interface AvatarStatus {
  status: "pending" | "done" | "failed";
  url?: string;
  error?: string;
}

const HEYGEN = () => process.env.HEYGEN_API_BASE || "https://api.heygen.com";

function providerOf(brand: BrandProfile) {
  if (env.aiProvider === "mock" && !process.env.HEYGEN_API_KEY) return "mock";
  return brand.avatarProvider || "heygen";
}

export function avatarConfigured(brand: BrandProfile) {
  return providerOf(brand) === "mock" || Boolean(brand.avatarId && brand.voiceId && process.env.HEYGEN_API_KEY);
}

/** Teleprompter → plain spoken text (provider limits ~5,000 characters). */
export function spokenText(teleprompter: string) {
  return teleprompter.split(/\n+/).map((l) => l.trim()).filter(Boolean).join(" ").slice(0, 4800);
}

export async function startAvatarVideo(brand: BrandProfile, text: string): Promise<AvatarStart> {
  const provider = providerOf(brand);
  if (provider === "mock") return { provider, jobId: await mockRender(text) };
  if (provider !== "heygen") throw new Error(`unknown avatar provider ${provider}`);
  const res = await fetch(`${HEYGEN()}/v2/video/generate`, {
    method: "POST",
    headers: { "X-Api-Key": process.env.HEYGEN_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: brand.avatarId, avatar_style: "normal" },
          voice: { type: "text", voice_id: brand.voiceId, input_text: text },
          background: { type: "color", value: "#101426" },
        },
      ],
      dimension: { width: 1080, height: 1920 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const body: any = await res.json().catch(() => ({}));
  const id = body?.data?.video_id;
  if (!res.ok || !id) throw new Error(`HeyGen generate failed (${res.status}): ${JSON.stringify(body?.error ?? body).slice(0, 300)}`);
  return { provider, jobId: id };
}

export async function avatarStatus(provider: string, jobId: string): Promise<AvatarStatus> {
  if (provider === "mock") return { status: "done", url: `file://${jobId}` };
  const res = await fetch(`${HEYGEN()}/v1/video_status.get?video_id=${encodeURIComponent(jobId)}`, {
    headers: { "X-Api-Key": process.env.HEYGEN_API_KEY ?? "" },
    signal: AbortSignal.timeout(30_000),
  });
  const body: any = await res.json().catch(() => ({}));
  const d = body?.data ?? {};
  if (d.status === "completed" && d.video_url) return { status: "done", url: d.video_url };
  if (d.status === "failed") return { status: "failed", error: JSON.stringify(d.error ?? "failed").slice(0, 300) };
  return { status: "pending" };
}

export async function downloadVideo(url: string, file: string) {
  if (url.startsWith("file://")) return copyFile(url.slice(7), file);
  const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(file));
}

/** Placeholder "twin" video: colour bars + tone, ~2.5 words per second, 9:16. */
async function mockRender(text: string) {
  const seconds = Math.max(4, Math.min(60, Math.round(text.split(/\s+/).length / 2.5)));
  const dir = await mkdtemp(path.join(tmpdir(), "studio-twin-"));
  const out = path.join(dir, "twin.mp4");
  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=720x1280:rate=30:duration=${seconds}`,
      "-f", "lavfi", "-i", `sine=frequency=330:duration=${seconds}`, "-c:v", "libx264", "-preset", "veryfast",
      "-c:a", "aac", "-shortest", out,
    ]);
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error("mock render failed"))));
  });
  return out;
}
