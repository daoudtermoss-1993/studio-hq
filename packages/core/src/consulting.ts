import { and, asc, db, desc, engagementInterviews, engagements, eq, sql, type BrandProfile, type Engagement, type EngagementStage } from "@studio/db";
import type { z } from "zod";
import { brandOf } from "./helpers";
import { parseCatalog } from "./opportunities";
import { enqueue } from "./queue";
import {
  AccountResearchOut, DemoOut, InterviewOut, OpportunityMapOut, PilotPlanOut, PilotReportOut, ProposalOut, ReviewOut,
  type OppInputs, type OpportunityMap,
} from "./schemas";
import { ask, log, runAgent } from "./team";
import { localDate } from "./time";

/**
 * Consulting division: the owner is the consultant. The team researches the company, turns interview notes into findings,
 * maps and scores AI opportunities (money computed here, never by the model), writes proposals, builds a demo of the chosen
 * pilot, plans the pilot inside the client's own environment and reports before/after numbers the owner measured.
 */

export const STAGES: EngagementStage[] = ["lead", "proposal", "assessment", "pilot", "retainer", "closed", "lost"];
export const MARKETS = ["lebanon", "gulf", "remote"] as const;
export const SOURCES = ["network", "linkedin", "referral", "freelance", "event", "other"] as const;
export const INTERVIEW_ROLES = ["management", "team", "it", "finance", "other"] as const;
export type InterviewRole = (typeof INTERVIEW_ROLES)[number];

/** The discovery questions from the method (shown to the owner while he interviews, given to the analyst as context). */
export const QUESTION_BANK: Record<Exclude<InterviewRole, "other">, string[]> = {
  management: [
    "شو بدك يكون تغيّر بعد 6 أشهر؟ كيف بتعرف إنو نجحنا؟",
    "وين عم تخسر وقت أو مصاري أو زبائن هلّق؟",
    "شو جرّبتو قبل، وليش ما زبط؟",
    "شو الخطوط الحمرا: داتا ممنوع تطلع، أو قرارات ما بتترك للآلة؟",
    "مين لازم يوافق غيرك، وقديش الميزانية التقريبية؟",
  ],
  team: [
    "خبّرني عن نهار عادي، من أول ما توصل.",
    "شو الشغلة اللي بتعيدا أكتر شي؟ قديش بتاخد كل مرة؟",
    "وين بتعلق؟ شو بتستنى من غيرك؟",
    "وين بتدوّر عالمعلومة، وقديش بتاخد لتلاقيها؟",
    "إذا في شغلة وحدة بتختفي من نهارك، شو هيي؟",
  ],
  it: [
    "شو الأنظمة الأساسية (تذاكر، CRM، ERP، monitoring)؟ في API أو export؟",
    "وين قاعدة الداتا: cloud ولا سيرفر داخلي؟ ومين بيملكها؟",
    "شو قواعد الأمن؟ شو ممنوع يطلع برّا الشبكة؟",
    "في حساب cloud أو سيرفر منشغّل عليه التجربة؟",
    "مين بيصون الحل بعد ما نسلّم؟",
  ],
  finance: [
    "قديش بتكلّف ساعة الموظف بهالفريق تقريباً؟",
    "كم شخص بيشتغل بهالشغلة؟ وعم توظّفوا كمان؟",
    "شو بيكلّف الغلط أو التأخير: زبون بيفلّ، غرامة، شغل معاد؟",
  ],
};

// ---------- privacy ----------

/** Masks emails, IBANs and long digit runs (phones, card and account numbers) before notes are stored or sent to a model. */
export function redact(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}\b/g, "[iban]")
    .replace(/\+?\d[\d\s().-]{5,}\d/g, (m, offset: number, all: string) => {
      const digits = m.replace(/\D/g, "").length;
      if (digits < 7) return m;
      if (/^\d{4}-\d{2}-\d{2}$/.test(m.trim())) return m; // a date
      if (/[$€£]$/.test(all.slice(Math.max(0, offset - 1), offset))) return m; // an amount
      return "[number]";
    });
}

// ---------- the money (deterministic) ----------

type Inputs = z.infer<typeof OppInputs>;
export type Quadrant = "start-here" | "later" | "small-win" | "avoid";

/** Savings = tasks per month × minutes saved ÷ 60 × cost per hour, minus the monthly running cost. */
export function oppMath(i: Inputs) {
  const savingMonthly = Math.round(i.tasksPerMonth * (i.minutesSaved / 60) * i.hourlyCost);
  const netMonthly = savingMonthly - Math.round(i.runningMonthly ?? 0);
  return { savingMonthly, netMonthly, netYearly: netMonthly * 12 };
}

/** Months to earn back (pilot price + setup) from the net monthly saving; null when it never pays back. */
export const paybackMonths = (investment: number, netMonthly: number) => (netMonthly > 0 ? Math.round((investment / netMonthly) * 10) / 10 : null);

export const quadrantOf = (value: number, ease: number): Quadrant =>
  value >= 3.5 ? (ease >= 3.5 ? "start-here" : "later") : ease >= 3.5 ? "small-win" : "avoid";

/** "$8,000" → 8000 · "$1,000/شهر" → 1000 · "" → 0 */
export const moneyOf = (price: string) => Number((price.match(/\d[\d,.]*/)?.[0] ?? "0").replace(/,/g, "")) || 0;

const Q_ORDER: Record<Quadrant, number> = { "start-here": 0, later: 1, "small-win": 2, avoid: 3 };

export type ScoredOpportunity = OpportunityMap["items"][number] & {
  savingMonthly: number; netMonthly: number; netYearly: number; paybackMonths: number | null; quadrant: Quadrant; priority: number;
};

/** Adds the computed money, the quadrant and the priority to every opportunity, and picks the first pilot. */
export function scoreOpportunities(map: OpportunityMap, pilotPrice: number) {
  const items: ScoredOpportunity[] = map.items
    .map((o) => {
      const m = oppMath(o.inputs);
      return {
        ...o, ...m, paybackMonths: paybackMonths(pilotPrice + (o.inputs.setupCost ?? 0), m.netMonthly),
        quadrant: quadrantOf(o.value, o.ease), priority: o.value * 2 + o.ease * 2 + o.speed,
      };
    })
    .sort((a, b) => Q_ORDER[a.quadrant] - Q_ORDER[b.quadrant] || b.priority - a.priority || b.netMonthly - a.netMonthly);
  const pick = items.find((o) => o.quadrant === "start-here" && o.redFlags.length === 0 && o.netMonthly > 0);
  return { summary: map.summary, items, recommended: pick?.id ?? null, pilotPrice };
}

export type PilotMetric = z.infer<typeof PilotPlanOut>["metrics"][number] & { baseline: number | null; current: number | null };

/** Before/after for each metric, and the realized monthly saving from measured minutes and volume. */
export function pilotResults(metrics: PilotMetric[], opp: { inputs: Inputs; savingMonthly: number } | null) {
  const rows = metrics.map((m) => {
    const change = m.baseline != null && m.current != null && m.baseline !== 0 ? (m.current - m.baseline) / Math.abs(m.baseline) : null;
    return { ...m, changePct: change == null ? null : Math.round(change * 1000) / 10, improved: change == null || change === 0 ? null : m.higherIsBetter ? change > 0 : change < 0 };
  });
  const mins = rows.find((m) => m.kind === "minutes-per-task" && m.baseline != null && m.current != null);
  const vol = rows.find((m) => m.kind === "tasks-per-month" && (m.current ?? m.baseline) != null);
  const realizedMonthly = mins && vol && opp
    ? Math.round((vol.current ?? vol.baseline)! * (Math.max(0, mins.baseline! - mins.current!) / 60) * opp.inputs.hourlyCost)
    : null;
  const promisedMonthly = opp?.savingMonthly ?? null;
  return { metrics: rows, realizedMonthly, promisedMonthly, hitTarget: realizedMonthly != null && promisedMonthly != null ? realizedMonthly >= promisedMonthly : null };
}

/** Payment terms come from the method, never from the model. */
export const TERMS = {
  assessment: [
    { pct: 50, en: "on signing", fr: "à la signature", ar: "عند التوقيع" },
    { pct: 50, en: "at the final presentation", fr: "à la présentation finale", ar: "بالعرض النهائي" },
    { pct: 0, en: "credited in full against the pilot if it starts within 30 days", fr: "déduit en totalité du pilote s'il démarre sous 30 jours", ar: "بينحسم كامل من سعر التجربة إذا بلّشت خلال 30 يوم" },
  ],
  pilot: [
    { pct: 40, en: "at the start", fr: "au démarrage", ar: "بالبداية" },
    { pct: 30, en: "when it runs in draft mode", fr: "quand il tourne en mode brouillon", ar: "لما يشتغل بوضع المسودة" },
    { pct: 30, en: "at delivery", fr: "à la livraison", ar: "عالتسليم" },
  ],
} as const;

export const langKey = (language: string): "ar" | "fr" | "en" => (/arab|عرب|leban/i.test(language) ? "ar" : /fren|fran/i.test(language) ? "fr" : "en");

/** The payment terms as lines in the client's language. */
export const termsFor = (kind: "assessment" | "pilot", language: string) =>
  TERMS[kind].map((t) => (t.pct ? `${t.pct}% ${t[langKey(language)]}` : t[langKey(language)]));

// ---------- records ----------

export async function getEngagement(id: string): Promise<Engagement> {
  const [e] = await db.select().from(engagements).where(eq(engagements.id, id));
  if (!e) throw new Error(`engagement ${id} not found`);
  return e;
}

async function updateEngagement(id: string, patch: Partial<typeof engagements.$inferInsert>) {
  const [e] = await db.update(engagements).set(patch).where(eq(engagements.id, id)).returning();
  return e;
}

const pickOf = <T extends readonly string[]>(list: T, v: string | undefined, fallback: T[number]): T[number] => ((list as readonly string[]).includes(v ?? "") ? (v as T[number]) : fallback);

export interface EngagementInput {
  company: string; website?: string; sector?: string; country?: string; size?: string; contactName?: string; contactRole?: string;
  source?: string; market?: string; language?: string; notes?: string;
}

export async function createEngagement(workspaceId: string, input: EngagementInput) {
  const [e] = await db
    .insert(engagements)
    .values({
      workspaceId, company: input.company.slice(0, 200), website: (input.website ?? "").slice(0, 300), sector: (input.sector ?? "").slice(0, 120),
      country: (input.country ?? "").slice(0, 80), size: (input.size ?? "").slice(0, 60), contactName: (input.contactName ?? "").slice(0, 120),
      contactRole: (input.contactRole ?? "").slice(0, 120), source: pickOf(SOURCES, input.source, "network"), market: pickOf(MARKETS, input.market, "lebanon"),
      language: (input.language || "Lebanese Arabic").slice(0, 60), notes: redact(input.notes ?? "").slice(0, 8000),
    })
    .returning();
  await enqueue("research-account", workspaceId, { engagementId: e.id }, { dedupeKey: `research:${e.id}` });
  await log(workspaceId, "account-researcher", `ملف جديد: ${e.company}`);
  return e;
}

export async function updateEngagementFacts(id: string, patch: Partial<EngagementInput>) {
  const clean: Partial<typeof engagements.$inferInsert> = {};
  for (const k of ["company", "website", "sector", "country", "size", "contactName", "contactRole", "language"] as const) {
    if (patch[k] != null) clean[k] = String(patch[k]).slice(0, 300);
  }
  if (patch.market) clean.market = pickOf(MARKETS, patch.market, "lebanon");
  if (patch.source) clean.source = pickOf(SOURCES, patch.source, "network");
  if (patch.notes != null) clean.notes = redact(patch.notes).slice(0, 8000);
  return updateEngagement(id, clean);
}

export async function setEngagementStage(workspaceId: string, id: string, stage: EngagementStage, value?: number | null) {
  const e = await getEngagement(id);
  if (e.workspaceId !== workspaceId || !STAGES.includes(stage)) throw new Error("not found");
  await updateEngagement(id, { stage, ...(value != null && Number.isFinite(value) ? { value: Math.max(0, Math.round(value)) } : {}) });
  if (stage === "assessment" || stage === "pilot" || stage === "retainer") await log(workspaceId, "ai-strategist", `${e.company}: ${stage} 🎉`);
}

export async function setEngagementPrices(id: string, prices: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(prices).filter(([k, v]) => ["assessment", "pilot", "retainer"].includes(k) && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 60)]));
  return updateEngagement(id, { prices: clean });
}

export function priceOf(brand: BrandProfile, e: Engagement, id: "assessment" | "pilot" | "retainer") {
  return e.prices?.[id] || parseCatalog(brand.consultingCatalog).find((c) => c.id === id)?.price || "";
}

export const interviewsOf = (engagementId: string) =>
  db.select().from(engagementInterviews).where(eq(engagementInterviews.engagementId, engagementId)).orderBy(asc(engagementInterviews.createdAt));

export async function addInterview(engagementId: string, input: { role: string; person?: string; notes: string }) {
  const e = await getEngagement(engagementId);
  const notes = redact(input.notes).slice(0, 12000);
  if (!notes.trim()) return null;
  const [iv] = await db
    .insert(engagementInterviews)
    .values({ workspaceId: e.workspaceId, engagementId, role: pickOf(INTERVIEW_ROLES, input.role, "other"), person: redact(input.person ?? "").slice(0, 120), notes })
    .returning();
  await enqueue("synthesize-interview", e.workspaceId, { interviewId: iv.id }, { dedupeKey: `iv:${iv.id}` });
  return iv;
}

// ---------- the team's work ----------

/** Replaces the content-studio brand profile: who the consultant is and who the client is. */
export function consultingContext(brand: BrandProfile, e: Engagement) {
  return `CONSULTANT (the owner)
- Expertise: ${brand.techFocus}
- Based in: ${brand.country} · Goals: ${brand.goals || "-"} · Red lines: ${brand.redLines || "-"}
- Owner's language (internal analysis, notes for the owner): ${brand.language}

CLIENT ENGAGEMENT
- Company: ${e.company}${e.website ? ` (${e.website})` : ""}
- Sector: ${e.sector || "?"} · Country: ${e.country || "?"} · Size: ${e.size || "?"} · Market: ${e.market}
- Contact: ${e.contactRole || "?"} · Source: ${e.source} · Stage: ${e.stage}
- Client's language (proposals, emails and reports the client reads): ${e.language}`;
}

const brief = (e: Engagement) =>
  `COMPANY: ${e.company}\nWEBSITE: ${e.website || "unknown"}\nSECTOR: ${e.sector || "?"} · COUNTRY: ${e.country || "?"} · SIZE: ${e.size || "?"}\nOWNER'S NOTES (first call): ${e.notes || "-"}`;

async function findings(e: Engagement) {
  const ivs = await interviewsOf(e.id);
  return ivs.filter((i) => i.synthesis).map((i) => ({ role: i.role, person: i.person, ...i.synthesis }));
}

export async function researchAccount(engagementId: string) {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  const research = await runAgent(e.workspaceId, "account-researcher", `بحث: ${e.company}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "account-researcher",
      `Today is ${localDate(brand.timezone)}.\n${brief(e)}
Research this company from public sources only (its website, news, job posts, public reviews, LinkedIn company page).
What do they do, how big, which systems they likely use, which public signals show repetitive work or slow service (cite each),
where AI could plausibly help, red flags, and 5–8 sharp questions for the first call. Write for the owner in ${brand.language}.`,
      AccountResearchOut, { webSearch: true, webFetch: true, context: consultingContext(brand, e), extraSkills: ["ai-engineering"] }),
  );
  await updateEngagement(engagementId, { research });
}

export async function synthesizeInterview(interviewId: string) {
  const [iv] = await db.select().from(engagementInterviews).where(eq(engagementInterviews.id, interviewId));
  if (!iv) throw new Error(`interview ${interviewId} not found`);
  const e = await getEngagement(iv.engagementId);
  const brand = await brandOf(e.workspaceId);
  const bank = iv.role in QUESTION_BANK ? QUESTION_BANK[iv.role as keyof typeof QUESTION_BANK] : [];
  const synthesis = await runAgent(e.workspaceId, "discovery-analyst", `مقابلة: ${e.company} · ${iv.role}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "discovery-analyst",
      `${brief(e)}\nINTERVIEW ROLE: ${iv.role}\nPERSON: ${iv.person || "-"}\nQUESTIONS THE OWNER WAS ASKING: ${bank.join(" | ") || "-"}
RAW NOTES (masked):\n${iv.notes}
Extract every repetitive task with who does it, timesPerMonth and minutesEach ONLY if the notes say them (convert "per day" with 22
working days and "per week" with 4.3, and say so in the quote), who said it, and a short quote. hourlyCost only if the notes state
it. Systems, data, constraints, risks, and the open questions to ask next. Write for the owner in ${brand.language}.`,
      InterviewOut, { tier: "fast", context: consultingContext(brand, e) }),
  );
  await db.update(engagementInterviews).set({ synthesis }).where(eq(engagementInterviews.id, interviewId));
}

export async function mapOpportunities(engagementId: string) {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  const found = await findings(e);
  const map = await runAgent(e.workspaceId, "ai-strategist", `فرص: ${e.company}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "ai-strategist",
      `${brief(e)}\nRESEARCH: ${JSON.stringify(e.research ?? {}).slice(0, 6000)}\nINTERVIEW FINDINGS: ${JSON.stringify(found).slice(0, 20000)}
List 4–8 AI opportunities for this company. For each: short id (kebab-case), title, the problem in their words, the solution,
value/ease/speed 1–5, and the inputs for the formula — tasksPerMonth, minutesSaved per task, hourlyCost, runningMonthly (API +
hosting, USD), setupCost beyond the pilot price — with inputSources saying "interview: <who>" or "assumption" for each of the first
three. Use the findings' numbers when they exist; otherwise a conservative assumption, labelled. Name data needed, risks, red flags.
Do NOT compute savings. Write for the owner in ${brand.language}.`,
      OpportunityMapOut, { context: consultingContext(brand, e), extraSkills: ["ai-engineering", "automation"] }),
  );
  const scored = scoreOpportunities(map, moneyOf(priceOf(brand, e, "pilot")));
  await updateEngagement(engagementId, { opportunities: { ...scored, at: new Date().toISOString() } });
  if (!scored.recommended) await log(e.workspaceId, "ai-strategist", `${e.company}: ما في فرصة سهلة وقيمتها عالية بعد — بدنا مقابلة كمان`);
}

/** The owner corrects an input or a score: the money is recomputed by code. */
export async function updateOpportunity(engagementId: string, oppId: string, patch: Partial<Inputs> & { value?: number; ease?: number; speed?: number; choose?: boolean }) {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  const cur = e.opportunities as (ReturnType<typeof scoreOpportunities> & { at: string }) | null;
  if (!cur) return null;
  const clamp = (n: number | undefined, d: number) => (n != null && Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : d);
  const nn = (n: number | undefined, d: number) => (n != null && Number.isFinite(n) && n >= 0 ? n : d);
  const items = cur.items.map((o) => {
    if (o.id !== oppId) return o;
    const inputs = {
      tasksPerMonth: nn(patch.tasksPerMonth, o.inputs.tasksPerMonth), minutesSaved: nn(patch.minutesSaved, o.inputs.minutesSaved),
      hourlyCost: nn(patch.hourlyCost, o.inputs.hourlyCost), runningMonthly: nn(patch.runningMonthly, o.inputs.runningMonthly ?? 0),
      setupCost: nn(patch.setupCost, o.inputs.setupCost ?? 0),
    };
    const changed = (k: keyof typeof o.inputSources) => (patch[k] != null && patch[k] !== o.inputs[k] ? "owner" : o.inputSources[k]);
    return {
      ...o, inputs, value: clamp(patch.value, o.value), ease: clamp(patch.ease, o.ease), speed: clamp(patch.speed, o.speed),
      inputSources: { tasksPerMonth: changed("tasksPerMonth"), minutesSaved: changed("minutesSaved"), hourlyCost: changed("hourlyCost") },
    };
  });
  const rescored = scoreOpportunities({ summary: cur.summary, items }, moneyOf(priceOf(brand, e, "pilot")));
  const recommended = patch.choose ? oppId : rescored.recommended;
  return updateEngagement(engagementId, { opportunities: { ...rescored, recommended, at: cur.at } });
}

export function chosenOpportunity(e: Engagement): ScoredOpportunity | null {
  const o = e.opportunities as ReturnType<typeof scoreOpportunities> | null;
  return o?.items.find((i) => i.id === o.recommended) ?? null;
}

const termsText = (kind: "assessment" | "pilot") => termsFor(kind, "English").join("; ");

export async function writeProposal(engagementId: string, kind: "assessment" | "pilot") {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  const opp = chosenOpportunity(e);
  if (kind === "pilot" && !opp) throw new Error("map opportunities and choose a pilot first");
  const price = priceOf(brand, e, kind);
  const retainer = priceOf(brand, e, "retainer");
  const found = await findings(e);
  const scope = kind === "assessment"
    ? `KIND: assessment (2 weeks). INCLUDES: ${parseCatalog(brand.consultingCatalog).find((c) => c.id === "assessment")?.includes ?? ""}`
    : `KIND: pilot (4–6 weeks) for ONE opportunity: ${JSON.stringify({ title: opp!.title, problem: opp!.problem, solution: opp!.solution, savingMonthly: opp!.savingMonthly, netMonthly: opp!.netMonthly, paybackMonths: opp!.paybackMonths, inputSources: opp!.inputSources })}
Runs in the client's environment, read-only access first, draft mode (a person approves), before/after measurement. After it: retainer ${retainer}.`;
  const p = await runAgent(e.workspaceId, "proposal-writer", `عرض ${kind === "pilot" ? "تجربة" : "تقييم"}: ${e.company}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "proposal-writer",
      `${brief(e)}\n${scope}\nRESEARCH: ${JSON.stringify(e.research ?? {}).slice(0, 4000)}\nFINDINGS: ${JSON.stringify(found).slice(0, 8000)}
PRICE (we print it ourselves, don't change it): ${price}. PAYMENT TERMS (we print them ourselves): ${termsText(kind)}.
Write a one-page ${kind} proposal in the client's language (${e.language}): their problem in their words, approach, deliverables,
timeline, what we need from them, out of scope, how success is measured. Mention only numbers given above. Plus a short cover email
from the owner. Never invent clients, results or testimonials.`,
      ProposalOut, { context: consultingContext(brand, e) }),
  );
  const out = { ...p, kind, price, terms: termsFor(kind, e.language), at: new Date().toISOString() };
  await updateEngagement(engagementId, kind === "pilot" ? { pilotProposal: out } : { proposal: out });
}

export async function buildEngagementDemo(engagementId: string) {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  const opp = chosenOpportunity(e);
  if (!opp) throw new Error("choose a pilot first");
  const demo = await runAgent(e.workspaceId, "ai-engineer", `ديمو: ${opp.title}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "ai-engineer",
      `${brief(e)}\nPILOT TO PROVE: ${JSON.stringify({ title: opp.title, problem: opp.problem, solution: opp.solution, dataNeeded: opp.dataNeeded })}
Build the smallest working demo of this pilot on SYNTHETIC data shaped like theirs (never real customer data). Use the code execution
sandbox: write the files, mock the LLM and any external API with fixtures (the sandbox has no internet), write a test, RUN it, and
report the exact command and its real output. works=true only if the test passed. Return every file's full content.`,
      DemoOut, { codeExecution: true, extraSkills: ["software"], mockAs: "demo", maxTokens: 20000, context: consultingContext(brand, e) }),
  );
  const review = await runAgent(e.workspaceId, "security-reviewer", `مراجعة: ${opp.title}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "security-reviewer",
      `${brief(e)}\nPILOT: ${opp.solution}\nDATA NEEDED: ${opp.dataNeeded.join(", ")}\nDEMO FILES: ${JSON.stringify(demo.files).slice(0, 30000)}
Review the demo and the pilot's data handling for a client deployment: secrets, access (read-only first), personal data, prompt
injection from customer text, where the data lives, and the privacy law of ${e.country || "the client's country"}. Verdict.`,
      ReviewOut, { context: consultingContext(brand, e) }),
  );
  await updateEngagement(engagementId, { demo: { ...demo, oppId: opp.id }, review });
}

export async function planPilot(engagementId: string) {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  const opp = chosenOpportunity(e);
  if (!opp) throw new Error("choose a pilot first");
  const plan = await runAgent(e.workspaceId, "delivery-lead", `خطة التجربة: ${opp.title}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "delivery-lead",
      `${brief(e)}\nPILOT: ${JSON.stringify({ title: opp.title, solution: opp.solution, inputs: opp.inputs, inputSources: opp.inputSources, dataNeeded: opp.dataNeeded, risks: opp.risks })}
Plan a 4–6 week pilot inside the client's environment: weeks with goals and tasks, data access (read-only first, accounts in the
client's name), how a person approves the AI's drafts, rollback. Define 2–5 metrics to measure BEFORE and AFTER; include one
"minutes-per-task" and one "tasks-per-month" metric when the saving is about time, and say exactly how to measure each.
Write for the owner in ${brand.language}.`,
      PilotPlanOut, { context: consultingContext(brand, e) }),
  );
  const old = new Map(((e.pilot?.metrics ?? []) as PilotMetric[]).map((m) => [m.key, m]));
  const metrics: PilotMetric[] = plan.metrics.map((m) => ({ ...m, baseline: old.get(m.key)?.baseline ?? null, current: old.get(m.key)?.current ?? null }));
  await updateEngagement(engagementId, { pilot: { plan, metrics, oppId: opp.id, log: e.pilot?.log ?? [] } });
}

/** The owner types what he measured (baseline before, current now). */
export async function recordPilotMetrics(engagementId: string, values: Record<string, { baseline?: number | null; current?: number | null }>) {
  const e = await getEngagement(engagementId);
  if (!e.pilot) return null;
  const ok = (n: number | null | undefined, d: number | null) => (n === undefined ? d : n === null || Number.isFinite(n) ? n : d);
  const metrics = (e.pilot.metrics as PilotMetric[]).map((m) => (values[m.key] ? { ...m, baseline: ok(values[m.key].baseline, m.baseline), current: ok(values[m.key].current, m.current) } : m));
  const stamp = new Date().toISOString().slice(0, 10);
  const log = [...(e.pilot.log ?? []), { date: stamp, values: Object.fromEntries(metrics.map((m) => [m.key, { baseline: m.baseline, current: m.current }])) }].slice(-60);
  return updateEngagement(engagementId, { pilot: { ...e.pilot, metrics, log } });
}

export async function pilotReport(engagementId: string) {
  const e = await getEngagement(engagementId);
  const brand = await brandOf(e.workspaceId);
  if (!e.pilot) throw new Error("plan the pilot first");
  const opp = chosenOpportunity(e);
  const results = pilotResults(e.pilot.metrics, opp);
  const report = await runAgent(e.workspaceId, "delivery-lead", `تقرير التجربة: ${e.company}`.slice(0, 120), null, (h) =>
    ask(h, e.workspaceId, brand, "delivery-lead",
      `${brief(e)}\nPILOT: ${opp?.title ?? "-"}\nMEASURED RESULTS (computed from the owner's measurements): ${JSON.stringify(results)}
Write the progress report: headline, wins, issues, the next step, and a short message the owner can send to the client in
${e.language}. Use ONLY the numbers above; if a metric has no measurement yet, say it is not measured yet.`,
      PilotReportOut, { mockAs: "pilot-report", tier: "fast", context: consultingContext(brand, e) }),
  );
  await updateEngagement(engagementId, { pilotReport: { ...report, results, at: new Date().toISOString() } });
}

export async function consultingSummary(workspaceId: string) {
  const rows = await db
    .select({ stage: engagements.stage, n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${engagements.value}),0)` })
    .from(engagements)
    .where(eq(engagements.workspaceId, workspaceId))
    .groupBy(engagements.stage);
  const won = rows.filter((r) => ["assessment", "pilot", "retainer", "closed"].includes(r.stage)).reduce((s, r) => s + Number(r.value), 0);
  return { byStage: Object.fromEntries(rows.map((r) => [r.stage, Number(r.n)])) as Partial<Record<EngagementStage, number>>, won };
}

export const recentEngagements = (workspaceId: string, limit = 100) =>
  db.select().from(engagements).where(eq(engagements.workspaceId, workspaceId)).orderBy(desc(engagements.updatedAt)).limit(limit);

export async function ownEngagement(workspaceId: string, id: string) {
  const [e] = await db.select().from(engagements).where(and(eq(engagements.id, id), eq(engagements.workspaceId, workspaceId)));
  return e ?? null;
}

const HEADINGS = {
  ar: { problem: "المشكلة", approach: "شو رح نعمل", deliverables: "شو بتستلموا", timeline: "المدة", price: "السعر", terms: "الدفع", weNeed: "شو منحتاج منكن", outOfScope: "مش داخل بالعرض", success: "كيف منعرف إنو نجح" },
  en: { problem: "The problem", approach: "What we will do", deliverables: "What you receive", timeline: "Timeline", price: "Price", terms: "Payment", weNeed: "What we need from you", outOfScope: "Out of scope", success: "How we measure success" },
  fr: { problem: "Le problème", approach: "Ce que nous ferons", deliverables: "Ce que vous recevez", timeline: "Calendrier", price: "Prix", terms: "Paiement", weNeed: "Ce dont nous avons besoin", outOfScope: "Hors périmètre", success: "Comment mesurer le succès" },
} as const;

/** The proposal as plain text in the client's language, ready to paste into an email or a document. */
export function proposalText(p: z.infer<typeof ProposalOut> & { price: string; terms: string[] }, language: string) {
  const h = HEADINGS[langKey(language)];
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return [
    p.title, "",
    `${h.problem}: ${p.problemInTheirWords}`, "",
    `${h.approach}: ${p.approach}`, "",
    `${h.deliverables}:\n${list(p.deliverables)}`, "",
    `${h.timeline}:\n${list(p.timeline.map((t) => `${t.when}: ${t.what}`))}`, "",
    `${h.price}: ${p.price}`,
    `${h.terms}:\n${list(p.terms)}`, "",
    ...(p.weNeed.length ? [`${h.weNeed}:\n${list(p.weNeed)}`, ""] : []),
    ...(p.outOfScope.length ? [`${h.outOfScope}:\n${list(p.outOfScope)}`, ""] : []),
    `${h.success}: ${p.successMeasure}`,
  ].join("\n");
}
