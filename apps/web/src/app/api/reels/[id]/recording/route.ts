import { Readable } from "node:stream";
import { registerRecording, storage } from "@studio/core";
import { and, assets, db, eq, reels } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";

export const runtime = "nodejs";
const MAX = 2 * 1024 ** 3; // 2 GB
const TYPES: Record<string, string> = { "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/x-matroska": ".mkv" };

/** Streams the raw recording straight to storage (no buffering), then hands it to the video editor. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await currentWorkspace();
  const { id } = await params;
  const [reel] = await db.select().from(reels).where(and(eq(reels.id, id), eq(reels.workspaceId, workspace.id)));
  if (!reel) return new Response("not found", { status: 404 });
  if (!["ready_to_record", "scripted", "recorded", "edited"].includes(reel.status)) return new Response("reel is busy", { status: 409 });
  const mime = (req.headers.get("content-type") ?? "").split(";")[0];
  const ext = TYPES[mime];
  if (!ext) return new Response("unsupported video type", { status: 415 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX) return new Response("file too large", { status: 413 });
  if (!req.body) return new Response("empty body", { status: 400 });

  const key = `${workspace.id}/reels/${reel.number}/raw-${Date.now()}${ext}`;
  const size = await storage().put(key, Readable.fromWeb(req.body as any), mime);
  if (!size) return new Response("empty file", { status: 400 });
  const [asset] = await db.insert(assets).values({ workspaceId: workspace.id, reelId: reel.id, kind: "raw", key, mime, size }).returning();
  await registerRecording(reel.id, asset.id);
  return Response.json({ ok: true, assetId: asset.id });
}
