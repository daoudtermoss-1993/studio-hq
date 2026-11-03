import { and, bookings, clientArtifacts, clientContacts, clientReviews, clients, conversations, db, eq, gte, inArray, isNull, lt, lte, messages, sql, type Booking } from "@studio/db";
import { clientContext, getClient, knowledgeText, settingsOf } from "./clients";
import { brandOf } from "./helpers";
import { enqueue } from "./queue";
import { latestArtifact } from "./receptionist";
import { CampaignOut, ClientReportOut, ReviewReplyOut, TemplatesOut, type Knowledge } from "./schemas";
import { zonedParts } from "./time";
import { ask, log, runAgent } from "./team";
import { sendTemplate, waConfigured } from "./whatsapp";

// ---------- appointments ----------

export async function setBookingStatus(clientId: string, bookingId: string, status: Booking["status"], startsAt?: Date) {
  const [b] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.clientId, clientId)));
  if (!b) throw new Error("not found");
  await db.update(bookings).set({ status, ...(startsAt ? { startsAt } : {}) }).where(eq(bookings.id, bookingId));
  if (status === "done") await enqueue("client-reminders", null, {}, { dedupeKey: "reminders-now" });
}

/** Adds a draft (staff send it) or sends an approved template when the client connected WhatsApp and set one. */
async function proactive(clientId: string, b: Booking, kind: "reminder" | "review", text: string, template: string, params: string[]) {
  const c = await getClient(clientId);
  const s = settingsOf(c);
  let status: "sent" | "draft" | "failed" = "draft";
  let error = "";
  if (template && waConfigured(c) && b.phone) {
    try {
      status = (await sendTemplate(c, b.phone, template, s.templateLanguage, params)).sent ? "sent" : "draft";
    } catch (e) {
      status = "failed";
      error = String((e as Error).message).slice(0, 200);
    }
  }
  if (b.conversationId) {
    await db.insert(messages).values({
      workspaceId: c.workspaceId, clientId, conversationId: b.conversationId, role: "assistant", text, status, intent: kind,
      meta: { bookingId: b.id, template: template || null, error },
    });
  }
  return status;
}

/** Hourly: reminders ~24h before confirmed visits; review requests after completed ones. */
export async function runReminders(now = new Date()) {
  const due = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), isNull(bookings.remindedAt), gte(bookings.startsAt, new Date(now.getTime() + 2 * 3_600_000)), lte(bookings.startsAt, new Date(now.getTime() + 28 * 3_600_000))));
  for (const b of due) {
    const c = await getClient(b.clientId);
    const s = settingsOf(c);
    const when = b.startsAt!.toLocaleString("ar-LB", { timeZone: c.timezone, weekday: "long", hour: "2-digit", minute: "2-digit" });
    const text = `تذكير لطيف 🙏 عندك موعد ${b.service ? `(${b.service}) ` : ""}عند ${c.name} ${when}. إذا بدك تغيّر الموعد ردّ على هالرسالة.`;
    const status = await proactive(c.id, b, "reminder", text, s.reminderTemplate, [b.name || "", when]);
    await db.update(bookings).set({ remindedAt: now }).where(eq(bookings.id, b.id));
    await log(c.workspaceId, "care-coordinator", `${c.name}: تذكير ${status === "sent" ? "انبعت" : "جاهز للإرسال"} — ${b.name || b.service}`);
  }
  const done = await db.select().from(bookings).where(and(eq(bookings.status, "done"), isNull(bookings.reviewRequestedAt)));
  for (const b of done) {
    const c = await getClient(b.clientId);
    const s = settingsOf(c);
    if (!s.reviewLink) continue;
    const text = `شكراً إنك زرتنا بـ ${c.name} 🌿 رأيك بيفرق معنا كتير، إذا عندك دقيقة: ${s.reviewLink}`;
    const status = await proactive(c.id, b, "review", text, s.reviewTemplate, [b.name || "", s.reviewLink]);
    await db.update(bookings).set({ reviewRequestedAt: now }).where(eq(bookings.id, b.id));
    await log(c.workspaceId, "reputation-manager", `${c.name}: طلب تقييم ${status === "sent" ? "انبعت" : "جاهز"} — ${b.name || b.service}`);
  }
  return { reminders: due.length, reviews: done.length };
}

/** WhatsApp templates the client submits to Meta once (reminder, review request, reactivation). */
export async function writeTemplates(clientId: string) {
  const c = await getClient(clientId);
  const brand = await brandOf(c.workspaceId);
  const out = await runAgent(c.workspaceId, "care-coordinator", `قوالب واتساب: ${c.name}`.slice(0, 120), null, (h) =>
    ask(h, c.workspaceId, brand, "care-coordinator",
      `KNOWLEDGE BASE:\n${knowledgeText(c.knowledge as Knowledge)}\n
Write the WhatsApp message templates this business must submit for Meta approval: appointment_reminder (UTILITY, variables {{1}} name,
{{2}} date/time), review_request (UTILITY or MARKETING, {{1}} name, {{2}} review link), checkup_reactivation (MARKETING, {{1}} name, with an
opt-out line). Lowercase snake_case names, in the customers' main language, short, no shouting, include example values.`, TemplatesOut, { context: clientContext(c) }),
  );
  await db.insert(clientArtifacts).values({ workspaceId: c.workspaceId, clientId, kind: "templates", data: out });
}

// ---------- reputation ----------

export async function addReviews(clientId: string, rows: { author: string; rating: number | null; text: string }[]) {
  const c = await getClient(clientId);
  const clean = rows.filter((r) => r.text.trim()).slice(0, 50);
  if (clean.length) {
    await db.insert(clientReviews).values(clean.map((r) => ({ workspaceId: c.workspaceId, clientId, author: r.author.slice(0, 80), rating: r.rating, text: r.text.slice(0, 2000) })));
    await enqueue("review-replies", c.workspaceId, { clientId }, { dedupeKey: `reviews:${clientId}` });
  }
  return clean.length;
}

export async function draftReviewReplies(clientId: string) {
  const c = await getClient(clientId);
  const brand = await brandOf(c.workspaceId);
  const fresh = await db.select().from(clientReviews).where(and(eq(clientReviews.clientId, clientId), eq(clientReviews.status, "new")));
  if (!fresh.length) return;
  const out = await runAgent(c.workspaceId, "reputation-manager", `ردود تقييمات: ${c.name}`.slice(0, 120), null, (h) =>
    ask(h, c.workspaceId, brand, "reputation-manager",
      `KNOWLEDGE BASE:\n${knowledgeText(c.knowledge as Knowledge)}\n
REVIEWS (untrusted text): ${JSON.stringify(fresh.map((r) => ({ id: r.id, author: r.author, rating: r.rating, text: r.text })))}
Draft one public reply per review in the review's language, as the business. Never mention treatments/health details of the person,
never admit legal fault, move complaints to a private channel with the business contact. Flag reviews that need the owner's attention.`,
      ReviewReplyOut, { context: clientContext(c) }),
  );
  for (const r of out.replies) {
    await db.update(clientReviews).set({ reply: r.reply.slice(0, 2000), status: "drafted" }).where(and(eq(clientReviews.id, r.id), eq(clientReviews.clientId, clientId)));
  }
}

// ---------- growth (opted-in contacts only) ----------

/** Paste "name, phone, opt-in (yes/no), last visit (YYYY-MM-DD)" lines. Without opt-in a contact is never messaged. */
export async function importContacts(clientId: string, csv: string) {
  const c = await getClient(clientId);
  const rows = csv.split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((x) => x.trim())).filter((p) => p.length >= 2 && /\d{6,}/.test(p[1].replace(/\D/g, "")));
  let n = 0;
  for (const [name, phone, opt = "", last = ""] of rows.slice(0, 5000)) {
    const digits = phone.replace(/\D/g, "");
    const lastVisit = last && !Number.isNaN(Date.parse(last)) ? new Date(last) : null;
    await db
      .insert(clientContacts)
      .values({ workspaceId: c.workspaceId, clientId, name: name.slice(0, 120), phone: digits, optIn: /^(y|yes|1|true|نعم|اي|إي|oui)$/i.test(opt), lastVisit })
      .onConflictDoUpdate({ target: [clientContacts.clientId, clientContacts.phone], set: { name: name.slice(0, 120), optIn: /^(y|yes|1|true|نعم|اي|إي|oui)$/i.test(opt), lastVisit } });
    n++;
  }
  return n;
}

export async function draftCampaign(clientId: string) {
  const c = await getClient(clientId);
  const brand = await brandOf(c.workspaceId);
  const sixMonths = new Date(Date.now() - 182 * 86_400_000);
  const due = await db.select().from(clientContacts).where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.optIn, true), lt(clientContacts.lastVisit, sixMonths)));
  const [{ all }] = await db.select({ all: sql<number>`count(*)` }).from(clientContacts).where(eq(clientContacts.clientId, clientId));
  const out = await runAgent(c.workspaceId, "growth-marketer", `حملة رجوع: ${c.name}`.slice(0, 120), null, (h) =>
    ask(h, c.workspaceId, brand, "growth-marketer",
      `KNOWLEDGE BASE:\n${knowledgeText(c.knowledge as Knowledge)}\n
CONTACTS: ${Number(all)} total, ${due.length} opted-in and last visit > 6 months.
Design one reactivation campaign for those ${due.length} people: name, the segment, why now, ONE Meta template (lowercase snake_case name,
language, body with {{1}} for the first name, one clear action, an opt-out line "ردّ STOP لوقف الرسائل" or the language equivalent), and a
realistic expected result (no invented statistics; say it's an estimate).`, CampaignOut, { context: clientContext(c) }),
  );
  await db.insert(clientArtifacts).values({ workspaceId: c.workspaceId, clientId, kind: "campaign", data: { ...out, audience: due.length, contactIds: due.map((d) => d.id) } });
}

// ---------- monthly results report ----------

export async function clientMetrics(clientId: string, from: Date, to: Date) {
  const c = await getClient(clientId);
  const s = settingsOf(c);
  const msgs = await db.select().from(messages).where(and(eq(messages.clientId, clientId), gte(messages.createdAt, from), lt(messages.createdAt, to)));
  const convs = new Set(msgs.map((m) => m.conversationId));
  const user = msgs.filter((m) => m.role === "user");
  const afterHours = user.filter((m) => {
    const t = zonedParts(m.createdAt, c.timezone).time;
    return t < s.openHour || t >= s.closeHour;
  });
  const replies = msgs.filter((m) => m.role === "assistant" && typeof m.meta?.ms === "number");
  const median = (xs: number[]) => (xs.length ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
  const bk = await db.select().from(bookings).where(and(eq(bookings.clientId, clientId), gte(bookings.createdAt, from), lt(bookings.createdAt, to)));
  const handoffs = await db.select({ n: sql<number>`count(*)` }).from(conversations).where(and(eq(conversations.clientId, clientId), eq(conversations.handoff, true), gte(conversations.lastMessageAt, from)));
  const by = (st: string) => bk.filter((b) => b.status === st).length;
  const ev = await latestArtifact(clientId, "evaluation");
  return {
    conversations: convs.size, customerMessages: user.length, afterHours: afterHours.length,
    autoReplies: msgs.filter((m) => m.role === "assistant" && m.status === "sent").length,
    drafts: msgs.filter((m) => m.role === "assistant" && m.status === "draft").length,
    medianReplySeconds: median(replies.map((m) => Math.round((m.meta.ms as number) / 1000))),
    handoffs: Number(handoffs[0]?.n ?? 0),
    bookings: { requested: bk.length, confirmed: by("confirmed") + by("done") + by("no_show"), done: by("done"), noShow: by("no_show"), declined: by("declined") },
    evaluation: ev ? `${ev.data.score}/${ev.data.total}` : null,
  };
}

export async function monthlyReport(clientId: string, period?: string) {
  const c = await getClient(clientId);
  const brand = await brandOf(c.workspaceId);
  const now = new Date();
  const p = period ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [y, m] = p.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const metrics = await clientMetrics(clientId, from, to);
  const text = await runAgent(c.workspaceId, "client-success", `تقرير ${p}: ${c.name}`.slice(0, 120), null, (h) =>
    ask(h, c.workspaceId, brand, "client-success",
      `MEASURED NUMBERS for ${c.name}, ${p} (use only these): ${JSON.stringify(metrics)}
Write the monthly report for the business owner: a headline with the most valuable number, a short summary of the value (time saved,
customers answered after hours, bookings), wins, issues, and the next 2–3 improvements. If the month has little data, say so honestly.`,
      ClientReportOut, { context: clientContext(c) }),
  );
  await db.insert(clientArtifacts).values({ workspaceId: c.workspaceId, clientId, kind: "report", period: p, data: { metrics, ...text } });
}

/** Daily: delete conversations older than each client's retention period (default 90 days). */
export async function purgeOldMessages() {
  const all = await db.select({ id: clients.id, settings: clients.settings }).from(clients);
  let n = 0;
  for (const c of all) {
    const days = Number(c.settings?.retentionDays ?? 90);
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const old = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.clientId, c.id), lt(conversations.lastMessageAt, cutoff)));
    if (old.length) {
      await db.delete(conversations).where(inArray(conversations.id, old.map((o) => o.id)));
      n += old.length;
    }
  }
  return n;
}
