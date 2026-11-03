import { createHmac, timingSafeEqual } from "node:crypto";
import type { Client } from "@studio/db";
import { decryptSecret } from "./connectors";
import { env } from "./env";

/**
 * WhatsApp Business Platform (Cloud API). Each client connects its OWN number (phone number id + access token + app secret).
 * - Webhook POSTs are signed: X-Hub-Signature-256 = "sha256=" + hex(HMAC-SHA256(raw body, app secret)).
 * - Free-form replies only inside the 24-hour customer-service window; proactive messages need approved templates + opt-in.
 */
const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v24.0"}`;

export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface IncomingWa {
  phoneNumberId: string;
  from: string;
  name: string;
  id: string;
  type: string;
  text: string;
  at: Date;
}

/** Flattens a webhook payload into incoming messages (statuses and other events are ignored). */
export function parseWebhook(body: any): IncomingWa[] {
  const out: IncomingWa[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const v = change?.value;
      if (!v?.messages) continue;
      const names = Object.fromEntries((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name ?? ""]));
      for (const m of v.messages) {
        const text = m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) : "";
        out.push({
          phoneNumberId: v.metadata?.phone_number_id ?? "", from: String(m.from ?? ""), name: names[m.from] ?? "", id: String(m.id ?? ""),
          type: String(m.type ?? ""), text: String(text ?? "").slice(0, 2000), at: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
        });
      }
    }
  }
  return out;
}

export const waConfigured = (c: Client) => Boolean(c.waPhoneNumberId && c.waTokenEnc);

async function post(c: Client, body: Record<string, unknown>) {
  if (env.aiProvider === "mock" || !waConfigured(c)) return { sent: false as const, reason: waConfigured(c) ? "mock mode" : "WhatsApp not connected" };
  const res = await fetch(`${GRAPH()}/${encodeURIComponent(c.waPhoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${decryptSecret(c.waTokenEnc!)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
    signal: AbortSignal.timeout(20_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${JSON.stringify(j?.error ?? j).slice(0, 200)}`);
  return { sent: true as const, id: j?.messages?.[0]?.id as string | undefined };
}

export const sendText = (c: Client, to: string, text: string) => post(c, { to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } });

export const sendTemplate = (c: Client, to: string, name: string, language: string, params: string[] = []) =>
  post(c, {
    to, type: "template",
    template: { name, language: { code: language }, components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }] : [] },
  });

export const appSecretOf = (c: Client) => (c.waAppSecretEnc ? decryptSecret(c.waAppSecretEnc) : process.env.WHATSAPP_APP_SECRET || "");
