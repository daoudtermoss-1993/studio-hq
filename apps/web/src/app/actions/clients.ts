"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addReviews, connectWhatsApp, createClient, createClientFromProblem, enqueue, importContacts, releaseHandoff, saveKnowledge, sendDraft, setBookingStatus,
  staffReply, updateClientSettings, zonedToUtc,
} from "@studio/core";
import { and, bookings, clientReviews, clients, conversations, db, eq, messages, problems } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (id: string, tab = "") => revalidatePath(`/app/clients/${id}${tab ? `?tab=${tab}` : ""}`, "page");

async function ownClient(id: string) {
  const { workspace } = await currentWorkspace();
  const [c] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.workspaceId, workspace.id)));
  if (!c) throw new Error("not found");
  return c;
}

export async function createClientAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const name = str(form, "name");
  if (!name) return;
  const c = await createClient(workspace.id, { name, website: str(form, "website"), phone: str(form, "phone"), vertical: str(form, "vertical"), city: str(form, "city"), notes: str(form, "notes").slice(0, 8000) });
  redirect(`/app/clients/${c.id}`);
}

export async function clientFromDealAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const [p] = await db.select().from(problems).where(and(eq(problems.id, str(form, "problemId")), eq(problems.workspaceId, workspace.id)));
  if (!p) return;
  const c = await createClientFromProblem(p.id);
  redirect(`/app/clients/${c.id}`);
}

export async function rebuildKnowledgeAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  await db.update(clients).set({ notes: str(form, "notes").slice(0, 8000) }).where(eq(clients.id, c.id));
  await enqueue("build-knowledge", c.workspaceId, { clientId: c.id }, { dedupeKey: `kb:${c.id}` });
  back(c.id, "knowledge");
}

export async function saveKnowledgeAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  try {
    await saveKnowledge(c.id, JSON.parse(str(form, "json")));
  } catch {
    return;
  }
  await enqueue("evaluate-assistant", c.workspaceId, { clientId: c.id }, { dedupeKey: `eval:${c.id}` });
  back(c.id, "knowledge");
}

export async function runEvalAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  await enqueue("evaluate-assistant", c.workspaceId, { clientId: c.id }, { dedupeKey: `eval:${c.id}` });
  back(c.id);
}

export async function autoReplyAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  try {
    await updateClientSettings(c.id, { autoReply: str(form, "on") === "1" });
  } catch {
    /* gate: evaluation not passed */
  }
  back(c.id);
}

export async function sendDraftAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const [m] = await db.select().from(messages).where(and(eq(messages.id, str(form, "messageId")), eq(messages.clientId, c.id)));
  if (m) await sendDraft(m.id, str(form, "text") || undefined);
  back(c.id, "inbox");
}

export async function staffReplyAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, str(form, "conversationId")), eq(conversations.clientId, c.id)));
  if (conv) await staffReply(conv.id, str(form, "text"));
  back(c.id, "inbox");
}

export async function releaseHandoffAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, str(form, "conversationId")), eq(conversations.clientId, c.id)));
  if (conv) await releaseHandoff(conv.id);
  back(c.id, "inbox");
}

export async function bookingAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const status = str(form, "status") as "confirmed" | "declined" | "done" | "no_show" | "cancelled";
  if (!["confirmed", "declined", "done", "no_show", "cancelled"].includes(status)) return;
  const local = str(form, "startsAt"); // datetime-local in the client's timezone
  let startsAt: Date | undefined;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) {
    const [d, t] = local.split("T");
    startsAt = zonedToUtc(d, t.slice(0, 5), c.timezone);
  }
  const [b] = await db.select().from(bookings).where(and(eq(bookings.id, str(form, "bookingId")), eq(bookings.clientId, c.id)));
  if (b) await setBookingStatus(c.id, b.id, status, startsAt);
  back(c.id, "bookings");
}

export async function addReviewsAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const rows = str(form, "reviews").split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p.length >= 2)
    .map((p) => (p.length >= 3 ? { rating: Number.parseInt(p[0], 10) || null, author: p[1], text: p.slice(2).join(" | ") } : { rating: null, author: p[0], text: p[1] }));
  await addReviews(c.id, rows);
  back(c.id, "reviews");
}

export async function approveReviewAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  await db.update(clientReviews).set({ reply: str(form, "reply").slice(0, 2000), status: "approved" }).where(and(eq(clientReviews.id, str(form, "reviewId")), eq(clientReviews.clientId, c.id)));
  back(c.id, "reviews");
}

export async function importContactsAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  await importContacts(c.id, str(form, "csv").slice(0, 400_000));
  back(c.id, "growth");
}

export async function clientJobAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const type = str(form, "job");
  if (!["client-campaign", "client-templates", "client-report", "review-replies"].includes(type)) return;
  await enqueue(type as "client-campaign", c.workspaceId, { clientId: c.id }, { dedupeKey: `${type}:${c.id}` });
  back(c.id, str(form, "tab"));
}

export async function clientSettingsAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const time = (k: string, d: string) => (/^\d{2}:\d{2}$/.test(str(form, k)) ? str(form, k) : d);
  const num = (k: string, d: number, min: number, max: number) => Math.min(max, Math.max(min, Number.parseInt(str(form, k), 10) || d));
  const url = (k: string) => (/^https:\/\/\S+$/.test(str(form, k)) ? str(form, k) : "");
  const tpl = (k: string) => (/^[a-z0-9_]{1,80}$/.test(str(form, k)) ? str(form, k) : "");
  await updateClientSettings(c.id, {
    tone: str(form, "tone").slice(0, 300), escalation: str(form, "escalation").slice(0, 200), bookingLink: url("bookingLink"), reviewLink: url("reviewLink"),
    reminderTemplate: tpl("reminderTemplate"), reviewTemplate: tpl("reviewTemplate"), templateLanguage: str(form, "templateLanguage").slice(0, 10) || "ar",
    openHour: time("openHour", "09:00"), closeHour: time("closeHour", "18:00"), dailyCap: num("dailyCap", 300, 10, 5000), retentionDays: num("retentionDays", 90, 7, 730),
  });
  const tz = str(form, "timezone");
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    await db.update(clients).set({ timezone: tz }).where(eq(clients.id, c.id));
  } catch {
    /* keep */
  }
  back(c.id, "settings");
}

export async function connectWaAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  try {
    await connectWhatsApp(c.id, { phoneNumberId: str(form, "phoneNumberId"), accessToken: str(form, "accessToken") || undefined, appSecret: str(form, "appSecret") || undefined });
  } catch {
    return;
  }
  back(c.id, "settings");
}

export async function clientStatusAction(form: FormData) {
  const c = await ownClient(str(form, "clientId"));
  const status = str(form, "status");
  if (status === "active" || status === "paused") await db.update(clients).set({ status }).where(eq(clients.id, c.id));
  back(c.id, "settings");
}
