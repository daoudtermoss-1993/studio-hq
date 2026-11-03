import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  and, bookings, brandProfiles, clientArtifacts, clientContacts, clientReviews, clients, conversations, db, eq, jobs, memberships, messages, pool, problems,
  runMigrations, users, workspaces,
} from "@studio/db";
import {
  addReviews, claimNext, complete, createClient, createClientFromProblem, draftCampaign, enqueue, groundingCheck, handleIncoming, importContacts,
  monthlyReport, parseWebhook, purgeOldMessages, releaseHandoff, runJob, runReminders, sendDraft, setBookingStatus, settingsOf, updateClientSettings,
  verifySignature, writeTemplates,
} from "../src";
import { mockKnowledge } from "../src/mock-clients";

let wsId = "";
let clientId = "";

async function drain(max = 80) {
  for (let i = 0; i < max; i++) {
    const job = await claimNext();
    if (!job) return;
    await runJob(job);
    await complete(job);
  }
}

beforeAll(async () => {
  await runMigrations();
  await db.delete(jobs);
  const stamp = Date.now();
  const [u] = await db.insert(users).values({ email: `cl${stamp}@test.dev`, name: "Cl", passwordHash: "x" }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Daoud Studio", slug: `cl-${stamp}` }).returning();
  await db.insert(memberships).values({ userId: u.id, workspaceId: w.id });
  await db.insert(brandProfiles).values({ workspaceId: w.id, niche: "AI for clinics", audience: "clinics", platforms: ["instagram"], pillars: ["حلول"] });
  wsId = w.id;
});

afterAll(async () => {
  await pool().end();
});

describe("safety checks in code", () => {
  const kb = mockKnowledge("YOU WORK FOR THIS BUSINESS (not for the studio): Test Clinic · x\nPhone: +961 1 000 001");
  it("grounding: prices and phone numbers must exist in the knowledge base", () => {
    expect(groundingCheck("التبييض $150 😊", kb as any).ok).toBe(true);
    expect(groundingCheck("Cleaning is 40$", kb as any).ok).toBe(true);
    expect(groundingCheck("التبييض بـ ١٥٠ دولار", kb as any).ok).toBe(true); // Arabic digits normalized
    expect(groundingCheck("التبييض $99 بس هالأسبوع", kb as any).ok).toBe(false);
    expect(groundingCheck("اتصل على 03 999 888", kb as any).ok).toBe(false);
    expect(groundingCheck("اتصل على +961 1 000 001", kb as any).ok).toBe(true);
  });

  it("WhatsApp: only correctly signed webhooks are accepted, and payloads are parsed", () => {
    const body = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "123456" }, contacts: [{ wa_id: "9613111222", profile: { name: "Rim" } }], messages: [{ from: "9613111222", id: "wamid.1", timestamp: "1767225600", type: "text", text: { body: "قديش التبييض؟" } }] } }] }] });
    const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(`${body} `, sig, "s3cret")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
    const [m] = parseWebhook(JSON.parse(body));
    expect(m).toMatchObject({ phoneNumberId: "123456", from: "9613111222", name: "Rim", id: "wamid.1", text: "قديش التبييض؟" });
    expect(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
  });
});

describe("client delivery (mock AI, real DB)", () => {
  it("a won deal becomes a client; the knowledge engineer builds its knowledge base and QA evaluates it", async () => {
    const [p] = await db.insert(problems).values({
      workspaceId: wsId, kind: "opportunity", url: "https://dr-samir.example", title: "عيادة د. سمير للأسنان", organization: "عيادة د. سمير للأسنان",
      body: "عيادات أسنان · بيروت", website: "https://dr-samir.example", phone: "+961 1 000 001", status: "won",
    }).returning();
    const c = await createClientFromProblem(p.id);
    expect((await createClientFromProblem(p.id)).id).toBe(c.id); // idempotent
    clientId = c.id;
    await drain();
    const [row] = await db.select().from(clients).where(eq(clients.id, clientId));
    expect(row.knowledge.services.length).toBeGreaterThan(2);
    expect(row.knowledge.unknowns.length).toBeGreaterThan(0);
    const [ev] = await db.select().from(clientArtifacts).where(and(eq(clientArtifacts.clientId, clientId), eq(clientArtifacts.kind, "evaluation")));
    expect(ev.data.total).toBe(30);
    expect(ev.data.score).toBeGreaterThanOrEqual(27);
    expect(ev.data.cases.find((x: any) => x.id === "q27").reply).not.toContain("50%");
    expect(settingsOf(row).evalPassed).toBe(true);
  });

  it("the receptionist answers from the knowledge base, in the customer's language", async () => {
    const r = await handleIncoming({ clientId, channel: "test", contact: "owner", text: "قديش سعر التبييض؟" });
    await drain();
    const replies = await db.select().from(messages).where(and(eq(messages.conversationId, r!.conversationId), eq(messages.role, "assistant")));
    expect(replies[0].text).toContain("$150");
    expect(replies[0].status).toBe("sent");
    expect(replies[0].intent).toBe("price");

    const fr = await handleIncoming({ clientId, channel: "demo", contact: "demo-1", text: "Quels sont vos horaires ?" });
    await drain();
    const [frReply] = await db.select().from(messages).where(and(eq(messages.conversationId, fr!.conversationId), eq(messages.role, "assistant")));
    expect(frReply.text).toMatch(/Nos horaires/);
  });

  it("medical questions hand over to a human and the assistant stops replying in that conversation", async () => {
    const r = await handleIncoming({ clientId, channel: "test", contact: "patient-2", text: "سني عم يوجعني كتير شو آخد دوا؟" });
    await drain();
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, r!.conversationId));
    expect(conv.handoff).toBe(true);
    await handleIncoming({ clientId, channel: "test", contact: "patient-2", text: "؟؟" });
    await drain();
    const replies = await db.select().from(messages).where(and(eq(messages.conversationId, conv.id), eq(messages.role, "assistant")));
    expect(replies).toHaveLength(1);
    await releaseHandoff(conv.id);
  });

  it("WhatsApp messages are drafts until the client turns on automatic replies; duplicates are ignored", async () => {
    const a = await handleIncoming({ clientId, channel: "whatsapp", contact: "9613111222", contactName: "Rim", text: "اسمي ريم بدي احجز موعد تنظيف بكرا الساعة 5", externalId: "wamid.A" });
    expect(await handleIncoming({ clientId, channel: "whatsapp", contact: "9613111222", text: "dup", externalId: "wamid.A" })).toBeNull();
    await drain();
    const [draft] = await db.select().from(messages).where(and(eq(messages.conversationId, a!.conversationId), eq(messages.role, "assistant")));
    expect(draft.status).toBe("draft");
    const [b] = await db.select().from(bookings).where(eq(bookings.conversationId, a!.conversationId));
    expect(b).toMatchObject({ name: "ريم", status: "requested", phone: "9613111222" });
    await sendDraft(draft.id);
    const [sent] = await db.select().from(messages).where(eq(messages.id, draft.id));
    expect(sent.status).toBe("sent");
  });

  it("automatic replies cannot be enabled before the evaluation passes", async () => {
    const other = await createClient(wsId, { name: "New Clinic" });
    await expect(updateClientSettings(other.id, { autoReply: true })).rejects.toThrow(/evaluation/);
    await updateClientSettings(clientId, { autoReply: true });
  });

  it("customer replies run on the fast lane even while the workspace has a long job running", async () => {
    const [long] = await db.insert(jobs).values({ type: "design-site", workspaceId: wsId, status: "running", payload: {} }).returning();
    const r = await handleIncoming({ clientId, channel: "test", contact: "fast", text: "في موقف سيارات؟" });
    const job = await claimNext();
    expect(job?.type).toBe("receptionist-reply");
    await runJob(job!);
    await complete(job!);
    expect(await claimNext({ lane: "fast" })).toBeNull();
    await db.delete(jobs).where(eq(jobs.id, long.id));
    const [rep] = await db.select().from(messages).where(and(eq(messages.conversationId, r!.conversationId), eq(messages.role, "assistant")));
    expect(rep.text).toContain("موقف");
  });

  it("confirmed visits get a reminder; finished visits get a review request (drafts without WhatsApp)", async () => {
    await updateClientSettings(clientId, { reviewLink: "https://g.page/r/test" });
    const [b] = await db.select().from(bookings).where(eq(bookings.clientId, clientId));
    await setBookingStatus(clientId, b.id, "confirmed", new Date(Date.now() + 22 * 3_600_000));
    expect((await runReminders()).reminders).toBe(1);
    expect((await runReminders()).reminders).toBe(0); // once
    await setBookingStatus(clientId, b.id, "done");
    await db.delete(jobs);
    expect((await runReminders()).reviews).toBe(1);
    const proactive = await db.select().from(messages).where(and(eq(messages.conversationId, b.conversationId!), eq(messages.role, "assistant")));
    expect(proactive.map((m) => m.intent)).toEqual(expect.arrayContaining(["reminder", "review"]));
    expect(proactive.find((m) => m.intent === "review")?.text).toContain("https://g.page/r/test");
  });

  it("reviews get drafted replies; reactivation only targets opted-in contacts; templates and the monthly report are written", async () => {
    expect(await addReviews(clientId, [{ author: "Rim", rating: 5, text: "أحلى عيادة" }, { author: "Sam", rating: 2, text: "انتظرت ساعة" }])).toBe(2);
    await drain();
    const rv = await db.select().from(clientReviews).where(eq(clientReviews.clientId, clientId));
    expect(rv.every((r) => r.status === "drafted" && r.reply.length > 5)).toBe(true);

    expect(await importContacts(clientId, "Rim, +961 3 111 222, yes, 2025-01-10\nSam, 03 444 555, no, 2025-01-10\nNour, 71 666 777, yes, " + new Date().toISOString().slice(0, 10))).toBe(3);
    await draftCampaign(clientId);
    const [camp] = await db.select().from(clientArtifacts).where(and(eq(clientArtifacts.clientId, clientId), eq(clientArtifacts.kind, "campaign")));
    expect(camp.data.audience).toBe(1); // only Rim: opted in + due
    const [rim] = await db.select().from(clientContacts).where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.name, "Rim")));
    expect(camp.data.contactIds).toEqual([rim.id]);
    expect(camp.data.template.body).toMatch(/STOP/);

    await writeTemplates(clientId);
    await monthlyReport(clientId);
    const [rep] = await db.select().from(clientArtifacts).where(and(eq(clientArtifacts.clientId, clientId), eq(clientArtifacts.kind, "report")));
    expect(rep.data.metrics.customerMessages).toBeGreaterThanOrEqual(5);
    expect(rep.data.metrics.bookings.done).toBe(1);
    expect(rep.data.metrics.evaluation).toMatch(/\/30$/);
  });

  it("old conversations are deleted after the retention period", async () => {
    await updateClientSettings(clientId, { retentionDays: 30 });
    const [old] = await db.select().from(conversations).where(eq(conversations.clientId, clientId)).limit(1);
    await db.update(conversations).set({ lastMessageAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(conversations.id, old.id));
    expect(await purgeOldMessages()).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(messages).where(eq(messages.conversationId, old.id))).toHaveLength(0);
    await enqueue("client-reminders", null, {}, { dedupeKey: "x" });
    await drain();
  });
});
