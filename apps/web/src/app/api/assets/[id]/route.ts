import { Readable } from "node:stream";
import { storage } from "@studio/core";
import { and, assets, db, eq } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";

export const runtime = "nodejs";

/** Serves a workspace file with HTTP Range support (so videos seek in the browser). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await currentWorkspace();
  const { id } = await params;
  const [asset] = await db.select().from(assets).where(and(eq(assets.id, id), eq(assets.workspaceId, workspace.id)));
  if (!asset) return new Response("not found", { status: 404 });
  const size = asset.size || (await storage().size(asset.key));
  const base = {
    "Content-Type": asset.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ...(new URL(req.url).searchParams.has("download") ? { "Content-Disposition": `attachment; filename="${asset.kind}-${asset.id}${asset.key.slice(asset.key.lastIndexOf("."))}"` } : {}),
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && size) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = await storage().read(asset.key, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = await storage().read(asset.key);
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers: { ...base, "Content-Length": String(size) } });
}
