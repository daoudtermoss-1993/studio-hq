import { chatThread, demoAllowed, handleIncoming } from "@studio/core";
import { clients, db, eq } from "@studio/db";

export const dynamic = "force-dynamic";
const SID = /^[A-Za-z0-9_-]{12,64}$/;

async function clientFor(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [c] = await db.select({ id: clients.id, status: clients.status, knowledge: clients.knowledge }).from(clients).where(eq(clients.demoToken, token));
  return c?.knowledge && c.status !== "paused" ? c : null;
}

/** Public demo chat: anyone with the unlisted link can talk to the assistant (rate-limited, never on WhatsApp). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const c = await clientFor((await params).token);
  const sid = new URL(req.url).searchParams.get("sid") ?? "";
  if (!c || !SID.test(sid)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(await chatThread(c.id, "demo", sid), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const c = await clientFor((await params).token);
  const body = await req.json().catch(() => ({}));
  const sid = String(body.sid ?? "");
  const text = String(body.text ?? "").trim().slice(0, 500);
  if (!c || !SID.test(sid) || !text) return Response.json({ error: "bad request" }, { status: 400 });
  if (!(await demoAllowed(c.id, sid))) return Response.json({ error: "rate" }, { status: 429 });
  await handleIncoming({ clientId: c.id, channel: "demo", contact: sid, text });
  return Response.json({ ok: true });
}
