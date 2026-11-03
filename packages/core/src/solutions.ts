import { and, db, desc, eq, gte, problems, reels, sql, type Problem } from "@studio/db";
import { AGENT_BY_ID, type AgentId } from "./agents";
import { brandOf } from "./helpers";
import { enqueue } from "./queue";
import { DemoOut, OutreachOut, ProblemHuntOut, QualifyOut, ReviewOut, SolutionOut } from "./schemas";
import { searchSource } from "./sources";
import { ask, log, runAgent } from "./team";
import { localDate } from "./time";

async function getProblem(id: string): Promise<Problem> {
  const [p] = await db.select().from(problems).where(eq(problems.id, id));
  if (!p) throw new Error(`problem ${id} not found`);
  return p;
}

async function updateProblem(id: string, patch: Partial<typeof problems.$inferInsert>) {
  const [p] = await db.update(problems).set(patch).where(eq(problems.id, id)).returning();
  return p;
}

const brief = (p: Problem) =>
  `PROBLEM (${p.track}, from ${p.source}): ${p.url}\nTitle: ${p.title}\nAuthor: ${p.author}${p.organization ? ` · ${p.organization}` : ""}
Posted: ${p.postedAt?.toISOString().slice(0, 10) ?? "?"} · votes: ${p.votes ?? "?"}\nWhat they wrote: ${p.body.slice(0, 2500)}${p.notes ? `\nOWNER NOTES: ${p.notes}` : ""}`;

/** Daily: find fresh public problems on both tracks, store them, qualify the most promising. */
export async function huntProblems(workspaceId: string) {
  const brand = await brandOf(workspaceId);
  if (!brand.solutionTracks.length) return;
  const since = new Date(Date.now() - 20 * 3_600_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(problems)
    .where(and(eq(problems.workspaceId, workspaceId), gte(problems.createdAt, since), sql`${problems.source} <> 'manual'`));
  if (Number(n) > 0) return;

  const inserted = await runAgent(workspaceId, "problem-hunter", "مشاكل اليوم", null, async (h) => {
    const out = await ask(h, workspaceId, brand, "problem-hunter",
      `Today is ${localDate(brand.timezone)}. Tracks: ${brand.solutionTracks.join(", ")}.
- smb: small businesses in ${brand.country} and the region (restaurants, clinics, shops, agencies…) struggling with operations,
  customer messages, bookings, marketing, invoices — solvable with automation or AI.
- technical: ${brand.techFocus}.
1) Give up to 8 source queries for the APIs we will call: reddit (where = subreddit), stackexchange (where = site such as
   networkengineering, serverfault, stackoverflow), hn, github (repo or topic keywords). Tag each query with its track.
2) With web search, add up to 8 more public posts (forums, groups, Q&A, LinkedIn/X posts) from the last 30 days, with exact URL,
   author handle, organization if public, and what they asked. Only public posts; nothing private or personal beyond the handle.`,
      ProblemHuntOut, { webSearch: true });
    const fromApis = [];
    for (const q of out.queries.slice(0, 8)) {
      await h.setTool(`${q.source} API`);
      try {
        fromApis.push(...(await searchSource(q.source, q.q, q.where)).map((p) => ({ ...p, track: q.track ?? (q.source === "reddit" ? "smb" : "technical") })));
      } catch (e) {
        await log(workspaceId, "problem-hunter", `${q.source}: ${String((e as Error).message).slice(0, 100)}`);
      }
    }
    const rows = [
      ...fromApis.map((p) => ({ ...p, organization: "" })),
      ...out.finds.map((f) => ({
        source: "web", track: f.track, url: f.url, title: f.title, body: f.body, author: f.author, organization: f.organization,
        contact: f.contact, postedAt: f.postedAt && !Number.isNaN(Date.parse(f.postedAt)) ? new Date(f.postedAt) : null, votes: null,
      })),
    ].filter((r) => /^https?:\/\//.test(r.url) && r.title);
    // The same question is often cross-posted: skip titles we already have (this batch or the last 60 days).
    const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const known = new Set(
      (await db.select({ title: problems.title }).from(problems)
        .where(and(eq(problems.workspaceId, workspaceId), gte(problems.createdAt, new Date(Date.now() - 60 * 86_400_000)))))
        .map((r) => norm(r.title)),
    );
    const fresh = rows.filter((r) => (known.has(norm(r.title)) ? false : (known.add(norm(r.title)), true)));
    if (!fresh.length) return [];
    return db
      .insert(problems)
      .values(fresh.map((r) => ({
        workspaceId, track: r.track, source: r.source, url: r.url, title: r.title.slice(0, 300), body: r.body.slice(0, 4000),
        author: r.author, organization: r.organization, contact: r.contact, postedAt: r.postedAt, votes: r.votes,
      })))
      .onConflictDoNothing()
      .returning();
  });
  const top = [...inserted].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).slice(0, 6);
  for (const p of top) await enqueue("qualify-problem", workspaceId, { problemId: p.id }, { dedupeKey: `qualify:${p.id}` });
}

export async function addProblem(workspaceId: string, input: { url: string; title: string; body: string; track: "smb" | "technical" }) {
  const [p] = await db
    .insert(problems)
    .values({ workspaceId, url: input.url, title: input.title.slice(0, 300), body: input.body.slice(0, 4000), track: input.track, source: "manual" })
    .onConflictDoNothing()
    .returning();
  if (p) await enqueue("qualify-problem", workspaceId, { problemId: p.id }, { dedupeKey: `qualify:${p.id}` });
  return p ?? null;
}

/** Chief engineer: can we solve it, what's it worth, who does it, how long, what price. */
export async function qualifyProblem(problemId: string) {
  const p = await getProblem(problemId);
  const brand = await brandOf(p.workspaceId);
  const q = await runAgent(p.workspaceId, "chief-engineer", `تقييم: ${p.title}`.slice(0, 120), null, (h) =>
    ask(h, p.workspaceId, brand, "chief-engineer",
      `${brief(p)}
Qualify this lead for our team (specialists: automation-engineer, ai-engineer, network-engineer, software-engineer).
Read the page if useful. Decide: can we solve it well, fit 0-10, what it is worth to them, can we reach the author/owner,
who should own it, effort range in days, price (setup + monthly) for their market. If no, give the reject reason.`,
      QualifyOut, { webSearch: true, webFetch: true, extraSkills: ["automation", "network", "ai-engineering"] }),
  );
  const ok = q.canSolve && q.fitScore >= 6;
  await updateProblem(problemId, { qualification: q, status: ok ? "qualified" : "rejected" });
  if (ok) await enqueue("solve-problem", p.workspaceId, { problemId }, { dedupeKey: `solve:${problemId}` });
}

/** Specialist designs the solution and builds a tested demo; security reviews; outreach is drafted. */
export async function solveProblem(problemId: string) {
  let p = await getProblem(problemId);
  if (!p.qualification) throw new Error("qualify first");
  const brand = await brandOf(p.workspaceId);
  const engineer = p.qualification.assignee as AgentId;
  const ws = p.workspaceId;
  await updateProblem(problemId, { status: "solving" });

  const solution = await runAgent(ws, engineer, `حل: ${p.title}`.slice(0, 120), null, (h) =>
    ask(h, ws, brand, engineer,
      `${brief(p)}\nCHIEF ENGINEER'S QUALIFICATION: ${JSON.stringify(p.qualification)}
Design the solution: root cause, approach, architecture, implementation steps, stack, monthly running cost, risks, and the demo plan.
Research current docs/pricing with web search and fetch; list your sources.`,
      SolutionOut, { webSearch: true, webFetch: true, extraSkills: ["engineering"], mockAs: "solution" }),
  );
  p = await updateProblem(problemId, { solution });

  const demo = await runAgent(ws, engineer, `ديمو: ${p.title}`.slice(0, 120), null, (h) =>
    ask(h, ws, brand, engineer,
      `${brief(p)}\nSOLUTION DESIGN: ${JSON.stringify(solution)}
Build the smallest working demo that proves the core of this solution. Use the code execution sandbox: write the files, mock any
external API with fixtures (the sandbox has no internet), write a test, RUN it, and report the exact command and its real output.
Set works=true only if the test actually passed. Return every file's full content.`,
      DemoOut, { codeExecution: true, extraSkills: ["software"], mockAs: "demo", maxTokens: 20000 }),
  );
  p = await updateProblem(problemId, { demo });

  const review = await runAgent(ws, "security-reviewer", `مراجعة أمان: ${p.title}`.slice(0, 120), null, (h) =>
    ask(h, ws, brand, "security-reviewer",
      `${brief(p)}\nSOLUTION: ${JSON.stringify(solution)}\nDEMO FILES: ${JSON.stringify(demo.files).slice(0, 30000)}
Review for security, privacy and third-party risk. Verdict approve / fix-first / reject.`, ReviewOut),
  );
  p = await updateProblem(problemId, { review });

  const outreach = await runAgent(ws, "outreach-writer", `رسالة: ${p.author || p.title}`.slice(0, 120), null, (h) =>
    ask(h, ws, brand, "outreach-writer",
      `${brief(p)}\nOUR SOLUTION (summary): ${solution.summary}\nDEMO: ${demo.works ? "working demo ready" : "design ready, demo partial"}
PRICE GUIDE: ${JSON.stringify(p.qualification?.price)}
Write one personal message to ${p.author || "the author"} (channel: where they posted or their public profile), in their language,
plus one follow-up and, if genuinely helpful, a short public reply that helps even if they never answer. The owner sends it.`, OutreachOut),
  );
  await updateProblem(problemId, { outreach, status: "solved" });
  await log(ws, "chief-engineer", `حل جاهز: ${p.title.slice(0, 60)} — ناطر تراجعو وتبعت الرسالة`);
}

/** Owner-driven deal stages after the solution is ready. */
export async function setDealStatus(workspaceId: string, problemId: string, status: "contacted" | "replied" | "won" | "lost", value?: number, note?: string) {
  const p = await getProblem(problemId);
  if (p.workspaceId !== workspaceId) throw new Error("not found");
  const stamp = new Date().toISOString().slice(0, 10);
  await updateProblem(problemId, {
    status, ...(value != null ? { dealValue: Math.max(0, Math.round(value)) } : {}),
    ...(note ? { notes: `${p.notes}\n[${stamp}] ${status}: ${note}`.trim() } : {}),
  });
  if (status === "won") await log(workspaceId, "chief-engineer", `زبون جديد 🎉 ${p.title.slice(0, 60)}`);
}

/** Turns a solved problem into an anonymized "problem → solution" reel. */
export async function reelFromProblem(problemId: string) {
  const p = await getProblem(problemId);
  if (!p.solution || p.reelId) return null;
  const brand = await brandOf(p.workspaceId);
  const reel = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${p.workspaceId}))`);
    const [{ max }] = await tx.select({ max: sql<number | null>`max(${reels.number})` }).from(reels).where(eq(reels.workspaceId, p.workspaceId));
    const [r] = await tx
      .insert(reels)
      .values({
        workspaceId: p.workspaceId, number: Number(max ?? 0) + 1, title: p.solution.summary.slice(0, 120),
        angle: `مشكلة ← حل: ${p.solution.approach}`.slice(0, 400), source: `problem:${p.id}`, pillar: p.track === "technical" ? "تقني" : "بزنس",
        platforms: p.track === "technical" ? [...new Set(["youtube", ...brand.platforms])] : brand.platforms, targetSeconds: brand.targetSeconds,
        presenter: brand.presenterMode === "avatar" ? "avatar" : "self",
        decision: { goal: "leads", why: "حل حقيقي لمشكلة حقيقية بيبيّن شو منعمل", monetization: `عرض الخدمة: ${p.qualification?.price?.setup ?? ""}`, platforms: brand.platforms },
      })
      .returning();
    await tx.update(problems).set({ reelId: r.id }).where(eq(problems.id, p.id));
    return r;
  });
  await enqueue("write-reel", p.workspaceId, { reelId: reel.id }, { dedupeKey: `write:${reel.id}` });
  return reel;
}

/** Context block for writeReel when a reel comes from a solved problem. */
export async function problemBlock(source: string) {
  if (!source.startsWith("problem:")) return "";
  const [p] = await db.select().from(problems).where(eq(problems.id, source.slice(8)));
  if (!p?.solution) return "";
  return `\nCASE STUDY (anonymize: no names, handles, company names or identifying details unless the owner says the client agreed):
Problem: ${p.title} — ${p.body.slice(0, 600)}\nRoot cause: ${p.solution.rootCause}\nSolution: ${p.solution.summary}\nSteps: ${p.solution.steps.join(" · ")}
Demo result: ${p.demo?.works ? p.demo.testOutput.slice(0, 400) : "design only"}
Format: [0-3s] the problem in their words → why it costs them → the solution working on screen → the result → CTA.`;
}

export async function solutionsSummary(workspaceId: string) {
  return db
    .select({ status: problems.status, n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${problems.dealValue}),0)` })
    .from(problems)
    .where(eq(problems.workspaceId, workspaceId))
    .groupBy(problems.status);
}

export const ENGINEERS = ["chief-engineer", "automation-engineer", "ai-engineer", "network-engineer", "software-engineer", "security-reviewer"] as const;
export const engineerName = (id: string, locale: "ar" | "en") => (locale === "ar" ? AGENT_BY_ID[id as AgentId]?.nameAr : AGENT_BY_ID[id as AgentId]?.nameEn) ?? id;
export const recentProblems = (workspaceId: string, limit = 100) =>
  db.select().from(problems).where(eq(problems.workspaceId, workspaceId)).orderBy(desc(problems.createdAt)).limit(limit);
