import { appSecretOf, getClient, handleIncoming, parseWebhook, verifySignature } from "@studio/core";

export const dynamic = "force-dynamic";

/** Meta webhook verification: echo hub.challenge when hub.verify_token matches this client's token. */
export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const u = new URL(req.url).searchParams;
  const c = await getClient((await params).clientId).catch(() => null);
  if (c && u.get("hub.mode") === "subscribe" && c.waVerifyToken && u.get("hub.verify_token") === c.waVerifyToken) {
    return new Response(u.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

/** Incoming WhatsApp messages: verify the signature on the RAW body, store (deduplicated), reply on the fast lane, answer 200 fast. */
export async function POST(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const c = await getClient((await params).clientId).catch(() => null);
  if (!c) return new Response("not found", { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000_000 || !verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecretOf(c))) return new Response("bad signature", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  for (const m of parseWebhook(body)) {
    if (m.phoneNumberId && c.waPhoneNumberId && m.phoneNumberId !== c.waPhoneNumberId) continue;
    const text = m.text || (m.type === "audio" ? "[voice note]" : m.type ? `[${m.type}]` : "");
    if (!text || !m.from) continue;
    await handleIncoming({ clientId: c.id, channel: "whatsapp", contact: m.from, contactName: m.name, text, externalId: m.id });
  }
  return new Response("ok", { status: 200 });
}
