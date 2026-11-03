"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addConnector, addProblem, addSiteToAudit, addViralLink, adoptViral, answerQuestion, dismissViral, enqueue, markPosted, reelFromProblem, rejectReel,
  removeConnector, secretReady, setConnectorEnabled, setDealStatus,
} from "@studio/core";
import { and, brandProfiles, dataImports, db, eq, lessons, memberships, problems, reels, viralFinds, workspaces } from "@studio/db";
import { currentWorkspace, requireUser } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, d: number, min = 1, max = 100) => {
  const n = Number.parseInt(str(f, k), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

function brandFields(f: FormData) {
  const timezone = str(f, "timezone") || "Asia/Beirut";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new Error("invalid timezone");
  }
  const postingTime = /^\d{2}:\d{2}$/.test(str(f, "postingTime")) ? str(f, "postingTime") : "19:30";
  return {
    niche: str(f, "niche"),
    audience: str(f, "audience"),
    language: str(f, "language") || "Lebanese Arabic",
    tone: str(f, "tone"),
    platforms: f.getAll("platforms").map(String).filter(Boolean),
    reelsPerWeek: int(f, "reelsPerWeek", 3, 1, 14),
    targetSeconds: int(f, "targetSeconds", 45, 10, 180),
    buffer: int(f, "buffer", 2, 1, 10),
    pillars: str(f, "pillars").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6),
    ctaKeyword: str(f, "ctaKeyword"),
    ctaReward: str(f, "ctaReward"),
    inspirations: str(f, "inspirations"),
    redLines: str(f, "redLines"),
    recordingSetup: str(f, "recordingSetup"),
    timezone,
    postingTime,
    country: (str(f, "country") || "LB").toUpperCase().slice(0, 2),
    goals: str(f, "goals"),
    presenterMode: ["self", "avatar", "auto"].includes(str(f, "presenterMode")) ? str(f, "presenterMode") : "self",
    avatarId: str(f, "avatarId"),
    voiceId: str(f, "voiceId"),
    solutionTracks: f.getAll("solutionTracks").map(String).filter((x) => x === "smb" || x === "technical"),
    ...(str(f, "serviceCatalog") ? { serviceCatalog: str(f, "serviceCatalog").slice(0, 4000) } : {}),
    techFocus: str(f, "techFocus") || "network automation (Cisco NSO, YANG, NETCONF/RESTCONF), AI & workflow automation",
  };
}

export async function createStudio(form: FormData) {
  const user = await requireUser();
  const [existing] = await db.select().from(memberships).where(eq(memberships.userId, user.id)).limit(1);
  if (existing) redirect("/app");
  const name = str(form, "studioName") || user.name;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "studio"}-${randomBytes(3).toString("hex")}`;
  const fields = brandFields(form);
  if (!fields.niche || !fields.audience || !fields.pillars.length) throw new Error("niche, audience and pillars are required");
  const ws = await db.transaction(async (tx) => {
    const [w] = await tx.insert(workspaces).values({ name, slug }).returning();
    await tx.insert(memberships).values({ userId: user.id, workspaceId: w.id, role: "owner" });
    await tx.insert(brandProfiles).values({ workspaceId: w.id, ...fields });
    return w;
  });
  await enqueue("bootstrap", ws.id, {}, { dedupeKey: "bootstrap", once: true });
  redirect("/app");
}

export async function saveBrand(form: FormData) {
  const { workspace } = await currentWorkspace();
  await db.update(brandProfiles).set(brandFields(form)).where(eq(brandProfiles.workspaceId, workspace.id));
  const name = str(form, "studioName");
  if (name) await db.update(workspaces).set({ name }).where(eq(workspaces.id, workspace.id));
  revalidatePath("/app", "layout");
}

export async function runToday() {
  const { workspace } = await currentWorkspace();
  await enqueue("daily-run", workspace.id, {}, { dedupeKey: "manual-daily" });
  revalidatePath("/app");
}

export async function runMeeting() {
  const { workspace } = await currentWorkspace();
  await enqueue("weekly-meeting", workspace.id, {}, { dedupeKey: "manual-meeting" });
  revalidatePath("/app/meeting");
}

async function ownedReel(reelId: string) {
  const { workspace } = await currentWorkspace();
  const [reel] = await db.select().from(reels).where(and(eq(reels.id, reelId), eq(reels.workspaceId, workspace.id)));
  if (!reel) throw new Error("not found");
  return reel;
}

export async function answer(form: FormData) {
  const reel = await ownedReel(str(form, "reelId"));
  const text = str(form, "answer");
  if (text) await answerQuestion(reel.id, str(form, "questionId"), text);
  revalidatePath(`/app/reels/${reel.number}`);
  revalidatePath("/app");
}

export async function approve(form: FormData) {
  const reel = await ownedReel(str(form, "reelId"));
  if (reel.status !== "edited") return;
  await db.update(reels).set({ status: "approved" }).where(eq(reels.id, reel.id));
  await enqueue("approve-reel", reel.workspaceId, { reelId: reel.id }, { dedupeKey: `approve:${reel.id}` });
  revalidatePath(`/app/reels/${reel.number}`);
}

export async function requestChanges(form: FormData) {
  const reel = await ownedReel(str(form, "reelId"));
  const changes = str(form, "changes");
  if (!changes || reel.status !== "edited") return;
  await enqueue("approve-reel", reel.workspaceId, { reelId: reel.id, changes });
  revalidatePath(`/app/reels/${reel.number}`);
}

export async function posted(form: FormData) {
  const reel = await ownedReel(str(form, "reelId"));
  if (reel.status === "scheduled") await markPosted(reel.id);
  revalidatePath(`/app/reels/${reel.number}`);
}

export async function lessonDecision(form: FormData) {
  const { workspace } = await currentWorkspace();
  const status = str(form, "decision") === "approved" ? "approved" : "rejected";
  await db.update(lessons).set({ status }).where(and(eq(lessons.id, str(form, "lessonId")), eq(lessons.workspaceId, workspace.id)));
  revalidatePath("/app/meeting");
}

export async function importData(form: FormData) {
  const { workspace } = await currentWorkspace();
  const kind = str(form, "kind") === "comments" ? "comments" : "metrics";
  const file = form.get("file");
  let content = str(form, "text");
  let filename = kind === "metrics" ? "pasted-metrics.csv" : "pasted-comments.txt";
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) throw new Error("file too large (max 5 MB)");
    content = await file.text();
    filename = file.name;
  }
  if (!content) return;
  const [imp] = await db.insert(dataImports).values({ workspaceId: workspace.id, kind, filename, content }).returning();
  await enqueue("analyze-import", workspace.id, { importId: imp.id });
  revalidatePath("/app/insights");
}

export async function rejectAction(form: FormData) {
  const reel = await ownedReel(str(form, "reelId"));
  if (!["edited", "ready_to_record", "scripted"].includes(reel.status)) return;
  await rejectReel(reel.id, str(form, "reason"));
  revalidatePath(`/app/reels/${reel.number}`);
  revalidatePath("/app");
}

export async function huntNow() {
  const { workspace } = await currentWorkspace();
  await enqueue("hunt-viral", workspace.id, {}, { dedupeKey: "manual-hunt" });
  revalidatePath("/app/viral");
}

export async function addViral(form: FormData) {
  const { workspace } = await currentWorkspace();
  const url = str(form, "url");
  if (!/^https?:\/\/\S+$/.test(url)) return;
  await addViralLink(workspace.id, url, str(form, "note"));
  revalidatePath("/app/viral");
}

async function ownedFind(id: string) {
  const { workspace } = await currentWorkspace();
  const [f] = await db.select().from(viralFinds).where(and(eq(viralFinds.id, id), eq(viralFinds.workspaceId, workspace.id)));
  if (!f) throw new Error("not found");
  return f;
}

export async function analyzeFind(form: FormData) {
  const f = await ownedFind(str(form, "findId"));
  await enqueue("analyze-viral", f.workspaceId, { findId: f.id }, { dedupeKey: `analyze:${f.id}` });
  revalidatePath("/app/viral");
}

export async function adoptFind(form: FormData) {
  const f = await ownedFind(str(form, "findId"));
  const reel = await adoptViral(f.id);
  if (reel) {
    await enqueue("write-reel", f.workspaceId, { reelId: reel.id }, { dedupeKey: `write:${reel.id}` });
    redirect(`/app/reels/${reel.number}`);
  }
  revalidatePath("/app/viral");
}

export async function dismissFind(form: FormData) {
  const f = await ownedFind(str(form, "findId"));
  await dismissViral(f.id);
  revalidatePath("/app/viral");
}

export async function runStrategy() {
  const { workspace } = await currentWorkspace();
  await enqueue("strategy", workspace.id, {}, { dedupeKey: "manual-strategy" });
  revalidatePath("/app/strategy");
}

export async function huntProblemsNow() {
  const { workspace } = await currentWorkspace();
  await enqueue("hunt-problems", workspace.id, {}, { dedupeKey: "manual-hunt-problems" });
  revalidatePath("/app/solutions");
}

export async function addProblemAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const url = str(form, "url");
  const body = str(form, "body");
  if (!/^https?:\/\/\S+$/.test(url) || !body) return;
  await addProblem(workspace.id, { url, title: str(form, "title") || body.slice(0, 80), body, track: str(form, "track") === "technical" ? "technical" : "smb" });
  revalidatePath("/app/solutions");
}

export async function dealAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const status = str(form, "status");
  if (!["contacted", "replied", "won", "lost"].includes(status)) return;
  const value = str(form, "value") ? Number(str(form, "value")) : undefined;
  await setDealStatus(workspace.id, str(form, "problemId"), status as "contacted" | "replied" | "won" | "lost", Number.isFinite(value) ? value : undefined, str(form, "note"));
  revalidatePath(`/app/solutions/${str(form, "problemId")}`);
  revalidatePath("/app/solutions");
}

export async function reelFromProblemAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const id = str(form, "problemId");
  const [own] = await db.select({ id: problems.id }).from(problems).where(and(eq(problems.id, id), eq(problems.workspaceId, workspace.id)));
  if (!own) return;
  const reel = await reelFromProblem(id);
  if (reel) redirect(`/app/reels/${reel.number}`);
}

export async function addConnectorAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const agents = form.getAll("agents").map(String);
  const token = str(form, "token");
  if (token && !secretReady()) return;
  await addConnector(workspace.id, { name: str(form, "name"), url: str(form, "url"), token: str(form, "token") || undefined, agents });
  revalidatePath("/app/connectors");
}

export async function connectorAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const id = str(form, "connectorId");
  const op = str(form, "op");
  if (op === "remove") await removeConnector(workspace.id, id);
  else await setConnectorEnabled(workspace.id, id, op === "enable");
  revalidatePath("/app/connectors");
}

export async function rerunProblem(form: FormData) {
  const { workspace } = await currentWorkspace();
  const id = str(form, "problemId");
  const [p] = await db.select().from(problems).where(and(eq(problems.id, id), eq(problems.workspaceId, workspace.id)));
  if (!p) return;
  const first = p.status === "new" || p.status === "rejected";
  const type = p.kind === "opportunity" ? (first ? "audit-site" : "design-site") : first ? "qualify-problem" : "solve-problem";
  if (!first) await db.update(problems).set({ status: "solving" }).where(eq(problems.id, id));
  const key = { "audit-site": "audit", "design-site": "design", "qualify-problem": "qualify", "solve-problem": "solve" }[type];
  await enqueue(type, workspace.id, { problemId: id }, { dedupeKey: `${key}:${id}` });
  revalidatePath(`/app/solutions/${id}`);
}

export async function huntOpportunitiesNow(form: FormData) {
  const { workspace } = await currentWorkspace();
  const vertical = str(form, "vertical").slice(0, 80);
  const city = str(form, "city").slice(0, 80);
  const limit = int(form, "limit", 10, 1, 20);
  if (vertical && city) await db.update(brandProfiles).set({ oppVertical: vertical, oppCity: city }).where(eq(brandProfiles.workspaceId, workspace.id));
  await enqueue("hunt-opportunities", workspace.id, { vertical, city, limit }, { dedupeKey: "manual-hunt-opportunities" });
  revalidatePath("/app/solutions");
}

export async function auditSiteAction(form: FormData) {
  const { workspace } = await currentWorkspace();
  const url = str(form, "url");
  if (!/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url)) return;
  const p = await addSiteToAudit(workspace.id, { url, name: str(form, "name") || undefined });
  revalidatePath("/app/solutions");
  if (p) redirect(`/app/solutions/${p.id}`);
}
