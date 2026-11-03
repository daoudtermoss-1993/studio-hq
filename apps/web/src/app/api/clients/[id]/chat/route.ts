import { chatThread, handleIncoming } from "@studio/core";
import { and, clients, db, eq } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function own(id: string) {
  const { workspace } = await currentWorkspace();
  const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, id), eq(clients.workspaceId, workspace.id)));
  return c ?? null;
}

/** The owner's private test chat with a client's assistant. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await own((await params).id);
  if (!c) return Response.json({ error: "not found" }, { status: 404 });
  const sid = new URL(req.url).searchParams.get("sid") || "owner";
  return Response.json(await chatThread(c.id, "test", `owner:${sid.slice(0, 40)}`), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await own((await params).id);
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim().slice(0, 1500);
  if (!c || !text) return Response.json({ error: "bad request" }, { status: 400 });
  await handleIncoming({ clientId: c.id, channel: "test", contact: `owner:${String(body.sid || "owner").slice(0, 40)}`, text });
  return Response.json({ ok: true });
}
