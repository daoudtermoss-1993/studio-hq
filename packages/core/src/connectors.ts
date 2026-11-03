import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, connectors, db, eq } from "@studio/db";
import type { McpServer } from "./ai";

/**
 * Remote MCP servers ("connectors") an agent may use through the Claude API MCP connector.
 * Tokens are encrypted at rest with AES-256-GCM using APP_SECRET and never sent to the browser.
 */
/** False in production without APP_SECRET: connectors with tokens can't be stored safely. */
export const secretReady = () => Boolean(process.env.APP_SECRET) || process.env.NODE_ENV !== "production";

function key() {
  const secret = process.env.APP_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("APP_SECRET is required to store connector tokens");
  return createHash("sha256").update(secret || "studio-hq-dev-secret").digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(packed: string) {
  const [iv, tag, enc] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const NAME = /^[a-z0-9][a-z0-9-]{1,39}$/;

export async function addConnector(workspaceId: string, input: { name: string; url: string; token?: string; agents: string[] }) {
  const name = input.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!NAME.test(name)) throw new Error("connector name: 2-40 chars, a-z 0-9 -");
  const url = new URL(input.url.trim());
  if (url.protocol !== "https:") throw new Error("MCP server URL must start with https://");
  const [c] = await db
    .insert(connectors)
    .values({ workspaceId, name, url: url.toString(), tokenEnc: input.token ? encryptSecret(input.token) : null, agents: input.agents })
    .returning();
  return c;
}

export async function removeConnector(workspaceId: string, id: string) {
  await db.delete(connectors).where(and(eq(connectors.id, id), eq(connectors.workspaceId, workspaceId)));
}

export async function setConnectorEnabled(workspaceId: string, id: string, enabled: boolean) {
  await db.update(connectors).set({ enabled }).where(and(eq(connectors.id, id), eq(connectors.workspaceId, workspaceId)));
}

/** Enabled MCP servers assigned to this agent, with decrypted tokens (server-side only). */
export async function connectorsFor(workspaceId: string, agent: string): Promise<McpServer[]> {
  const rows = await db.select().from(connectors).where(and(eq(connectors.workspaceId, workspaceId), eq(connectors.enabled, true)));
  return rows
    .filter((c) => c.agents.includes(agent) || c.agents.includes("*"))
    .map((c) => ({ name: c.name, url: c.url, token: c.tokenEnc ? decryptSecret(c.tokenEnc) : null }));
}

/** Built-in data sources and their status (for the connectors page). */
export function builtInSources() {
  return [
    { id: "web-search", ready: true },
    { id: "web-fetch", ready: true },
    { id: "code-sandbox", ready: true },
    { id: "stackexchange", ready: true },
    { id: "hackernews", ready: true },
    { id: "github", ready: true, boosted: Boolean(process.env.GITHUB_TOKEN) },
    { id: "reddit", ready: Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) },
    { id: "youtube", ready: Boolean(process.env.YOUTUBE_API_KEY) },
    { id: "google-places", ready: Boolean(process.env.GOOGLE_MAPS_API_KEY) },
    { id: "pagespeed", ready: true, boosted: Boolean(process.env.PAGESPEED_API_KEY) },
    { id: "heygen", ready: Boolean(process.env.HEYGEN_API_KEY) },
  ];
}
