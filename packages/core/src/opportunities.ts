import { randomBytes } from "node:crypto";
import { and, db, eq, isNotNull, lt, notInArray, problems, sql, type Problem } from "@studio/db";
import { inspectSite, mockSiteFacts, scoreSite, type SiteFacts } from "./audit";
import { env } from "./env";
import { brandOf } from "./helpers";
import { checkMockup, sanitizeMockup, searchPlaces, type Business } from "./places";
import { enqueue } from "./queue";
import { AuditReportOut, DesignOut, OutreachOut, ScoutOut } from "./schemas";
import { ask, log, runAgent } from "./team";

/**
 * Opportunities division: instead of waiting for someone to post a problem, we find local businesses (e.g. dental clinics in
 * Beirut), MEASURE their website, design a better one, and prepare a fixed-price offer + a personal message the owner sends.
 * Flow: hunt-opportunities → audit-site → design-site. Same deal board as problems (problems.kind = "opportunity").
 */

export interface CatalogItem {
  id: string;
  name: string;
  price: string;
  includes: string;
}

export function parseCatalog(text: string): CatalogItem[] {
  return text
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p.length >= 3 && p[0])
    .map(([id, name, price, includes = ""]) => ({ id, name, price, includes }));
}

const host = (u: string) => {
  try {
    return new URL(/^https?:/i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const normName = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const previewUrl = (token: string) => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/p/${token}`;

async function getOpp(id: string): Promise<Problem> {
  const [p] = await db.select().from(problems).where(eq(problems.id, id));
  if (!p || p.kind !== "opportunity") throw new Error(`opportunity ${id} not found`);
  return p;
}
const update = async (id: string, patch: Partial<typeof problems.$inferInsert>) =>
  (await db.update(problems).set(patch).where(eq(problems.id, id)).returning())[0];

/** Insert businesses we don't already have (same place, same website host or same name). Returns the new rows. */
async function insertBusinesses(workspaceId: string, list: Business[], vertical: string, city: string) {
  const existing = await db
    .select({ placeId: problems.placeId, website: problems.website, title: problems.title })
    .from(problems)
    .where(and(eq(problems.workspaceId, workspaceId), eq(problems.kind, "opportunity")));
  const places = new Set(existing.map((e) => e.placeId).filter(Boolean));
  const hosts = new Set(existing.map((e) => host(e.website)).filter(Boolean));
  const names = new Set(existing.map((e) => normName(e.title)));
  const fresh = list.filter((b) => {
    const h = host(b.website);
    if (!b.name || (b.placeId && places.has(b.placeId)) || (h && hosts.has(h)) || names.has(normName(b.name))) return false;
    if (b.placeId) places.add(b.placeId);
    if (h) hosts.add(h);
    names.add(normName(b.name));
    return true;
  });
  if (!fresh.length) return [];
  const expires = new Date(Date.now() + 30 * 86_400_000);
  return db
    .insert(problems)
    .values(fresh.map((b) => ({
      workspaceId, kind: "opportunity", track: "smb", source: b.source, url: b.website || b.mapsUrl, title: b.name.slice(0, 200),
      body: `${vertical} · ${city}${b.address ? ` · ${b.address}` : ""}`, author: b.name.slice(0, 200), organization: b.name.slice(0, 200),
      contact: b.mapsUrl, placeId: b.placeId, website: b.website, phone: b.phone, address: b.address, rating: b.rating, reviews: b.reviews,
      votes: b.reviews, googleExpiresAt: b.source === "google-maps" ? expires : null,
    })))
    .onConflictDoNothing()
    .returning();
}

/** Find businesses of a type in a city (Google Places when GOOGLE_MAPS_API_KEY is set, otherwise web search), then audit them. */
export async function huntOpportunities(workspaceId: string, input: { vertical?: string; city?: string; limit?: number } = {}) {
  const brand = await brandOf(workspaceId);
  const vertical = (input.vertical || brand.oppVertical).slice(0, 80);
  const city = (input.city || brand.oppCity).slice(0, 80);
  const limit = Math.max(1, Math.min(input.limit ?? 10, 20));
  const inserted = await runAgent(workspaceId, "opportunity-scout", `فرص: ${vertical} · ${city}`.slice(0, 120), null, async (h) => {
    let found: Business[] = [];
    if (process.env.GOOGLE_MAPS_API_KEY || env.aiProvider === "mock") {
      await h.setTool("Google Places");
      found = await searchPlaces(`${vertical} ${city}`, { region: brand.country, language: /arab/i.test(brand.language) ? "ar" : "en", max: limit * 2 });
    }
    if (!found.length) {
      const out = await ask(h, workspaceId, brand, "opportunity-scout",
        `Find up to ${limit + 5} real ${vertical} in ${city} (${brand.country}). Use web search. For each: exact business name, its own website URL if it
has one (not a directory page), public phone if listed on their own site or listing, address/area, the page where you found it, and why it
looks like a good fit (old/slow site, no booking, no website at all). Skip chains and hospitals. Public business info only.`,
        ScoutOut, { webSearch: true, tier: "fast" });
      found = out.businesses.map((b) => ({
        placeId: null, name: b.name, address: b.address, phone: b.phone, website: /^https?:\/\//i.test(b.website) ? b.website : "",
        rating: null, reviews: null, mapsUrl: /^https?:\/\//i.test(b.sourceUrl) ? b.sourceUrl : `https://www.google.com/search?q=${encodeURIComponent(`${b.name} ${city}`)}`, source: "web",
      }));
    }
    return insertBusinesses(workspaceId, found, vertical, city);
  });
  for (const p of inserted.slice(0, limit)) await enqueue("audit-site", workspaceId, { problemId: p.id }, { dedupeKey: `audit:${p.id}` });
  return inserted.length;
}

/** The owner pastes any website (or a business without one) to audit. */
export async function addSiteToAudit(workspaceId: string, input: { url: string; name?: string; phone?: string }) {
  const brand = await brandOf(workspaceId);
  const website = /^https?:\/\//i.test(input.url) ? input.url : input.url ? `https://${input.url}` : "";
  const [p] = await insertBusinesses(workspaceId, [{
    placeId: null, name: input.name || host(website) || "business", address: "", phone: input.phone ?? "", website, rating: null, reviews: null,
    mapsUrl: website, source: "web",
  }], brand.oppVertical, brand.oppCity);
  if (p) await update(p.id, { source: "manual" });
  if (p) await enqueue("audit-site", workspaceId, { problemId: p.id }, { dedupeKey: `audit:${p.id}` });
  return p ?? null;
}

const factsBlock = (p: Problem, facts: SiteFacts | null, score: ReturnType<typeof scoreSite> | null) =>
  `BUSINESS: ${p.title}\nTYPE/CITY: ${p.body}\nWEBSITE: ${p.website || "(none)"}\nPHONE: ${p.phone || "(unknown)"}
GOOGLE RATING: ${p.rating != null ? `${p.rating} (${p.reviews ?? 0} reviews)` : "(unknown)"}
${facts ? `MEASURED FACTS (mobile): ${JSON.stringify({ ...facts, psi: facts.psi ? { ...facts.psi, screenshot: undefined } : null, html: facts.html ? { ...facts.html, textSample: facts.html.textSample.slice(0, 600) } : null })}` : ""}
${score ? `OUR SCORE: ${score.score}/100 · areas ${JSON.stringify(score.areas)}\nFINDINGS: ${JSON.stringify(score.findings)}` : ""}`;

/** Measure the website (real tools), score it in code, then the auditor explains it and decides if it is worth an offer. */
export async function auditOpportunity(problemId: string) {
  const p = await getOpp(problemId);
  const brand = await brandOf(p.workspaceId);
  const catalog = parseCatalog(brand.serviceCatalog);
  const noSite = !p.website;
  const report = await runAgent(p.workspaceId, "web-auditor", `فحص: ${p.title}`.slice(0, 120), null, async (h) => {
    let facts: SiteFacts | null = null;
    if (!noSite) {
      await h.setTool("PageSpeed · TLS · HTML");
      facts = env.aiProvider === "mock" && process.env.AUDIT_LIVE !== "1" ? mockSiteFacts(p.website) : await inspectSite(p.website);
    }
    const score = facts ? scoreSite(facts) : { score: 0, areas: { speed: 0, mobile: 0, trust: 0, conversion: 0, seo: 0 }, findings: [{ id: "no-site", severity: "critical" as const, area: "conversion" as const, evidence: "no website" }] };
    const r = await ask(h, p.workspaceId, brand, "web-auditor",
      `${factsBlock(p, facts, score)}
OUR SERVICES (pick the one package that fixes the biggest money leak; use its id): ${catalog.map((c) => `${c.id}: ${c.name} (${c.price}) — ${c.includes}`).join(" | ")}
Write the audit for the business owner: a one-line headline with the single most important measured number, a short summary, the top issues
(use the finding ids above; each with a plain explanation and what it costs them), quick wins, the recommended package, and whether this is
worth an offer (false if the site is already good, i.e. score ≥ 80 with no critical/high findings, or if the business looks closed).
Only use numbers that appear in the facts. Also say the main language of their site/audience (ar, en, fr, or mixed).`,
      AuditReportOut, { tier: "smart" });
    return { facts, score, report: r };
  });
  const serious = report.score.findings.some((f) => f.severity === "critical" || f.severity === "high");
  const ok = report.report.worthIt && (report.score.score < 80 || serious);
  await update(problemId, {
    audit: report,
    status: ok ? "qualified" : "rejected",
    qualification: {
      canSolve: ok, fitScore: Math.round((100 - report.score.score) / 10), valueEstimate: report.report.headline, reachable: Boolean(p.phone || p.website),
      assignee: "web-designer", effortDays: { best: 2, likely: 4, worst: 7 },
      price: { setup: catalog.find((c) => c.id === report.report.recommendedPackage)?.price ?? "", monthly: "", currency: "USD" },
      why: report.report.why, rejectReason: ok ? "" : report.report.why, questions: [],
    },
  });
  if (ok) await enqueue("design-site", p.workspaceId, { problemId }, { dedupeKey: `design:${problemId}` });
}

/** The lead designer designs the new homepage (real HTML) + the system behind it; a quality gate checks it; then offer + message. */
export async function designOpportunity(problemId: string) {
  const p = await getOpp(problemId);
  if (!p.audit) throw new Error("audit first");
  const brand = await brandOf(p.workspaceId);
  const catalog = parseCatalog(brand.serviceCatalog);
  const ws = p.workspaceId;
  await update(problemId, { status: "solving" });
  const audit = p.audit as { facts: SiteFacts | null; score: ReturnType<typeof scoreSite>; report: import("./schemas").AuditReport };

  const design = await runAgent(ws, "web-designer", `تصميم: ${p.title}`.slice(0, 120), null, async (h) => {
    const base = `${factsBlock(p, audit.facts, audit.score)}
AUDIT: ${JSON.stringify(audit.report)}
WHAT THEIR CURRENT SITE SAYS (facts you may reuse): ${audit.facts?.html?.textSample ?? "(no website)"}

Design their new website as a principal designer + full-stack architect would for a paying client.
1) The visual system (concept, palette with hex, typography), sitemap, and audience.
2) A COMPLETE, production-quality homepage as ONE self-contained HTML file in "html": <!doctype html>, lang + dir (RTL if Arabic),
   responsive viewport, inline <style> only (Google Fonts link allowed), semantic header/nav/main/section/footer, exactly one h1, at least
   5 sections (hero with the WhatsApp booking CTA, services, why us/trust, how booking works, FAQ, hours & location, contact), a sticky
   mobile CTA bar, CSS custom properties, fluid type with clamp(), @media breakpoints, logical properties for RTL, inline SVG icons,
   no JavaScript, no external images, no event handlers. CTA links: https://wa.me/<digits of their phone> and tel:. Use ONLY facts you
   were given; anything unknown goes in a visible placeholder like [اسم الطبيب] and in "placeholders". Under 100 KB.
3) The backend/system to build it for real (architecture, stack, data model, integrations, hosting, performance budget, SEO, security,
   monthly running cost) and a phased build plan with days.`;
    let out = await ask(h, ws, brand, "web-designer", base, DesignOut, { tier: "smart", maxTokens: 32_000, extraSkills: ["software", "security"], mockAs: "web-designer" });
    let issues = checkMockup(out.html);
    if (issues.length) {
      await h.setTool("Quality gate");
      out = await ask(h, ws, brand, "web-designer",
        `${base}\n\nYOUR PREVIOUS HTML FAILED OUR QUALITY GATE. Fix every point and return the full result again:\n- ${issues.join("\n- ")}\n\nPREVIOUS HTML:\n${out.html.slice(0, 60_000)}`,
        DesignOut, { tier: "smart", maxTokens: 32_000, extraSkills: ["software", "security"], mockAs: "web-designer" });
      issues = checkMockup(out.html);
    }
    return { ...out, html: sanitizeMockup(out.html), gate: issues };
  });

  const pkg = catalog.find((c) => c.id === audit.report.recommendedPackage) ?? catalog.find((c) => c.id === (p.website ? "speed-fix" : "new-site")) ?? catalog[0];
  const ids = new Set(audit.score.findings.map((f) => f.id));
  const alsoSuggest = catalog
    .filter((c) => c.id !== pkg?.id && ((c.id === "whatsapp-booking" && (ids.has("no-whatsapp") || ids.has("no-booking") || ids.has("no-site"))) || (c.id === "google-profile" && (p.reviews ?? 0) < 100)))
    .map((c) => c.id);
  const token = p.previewToken ?? randomBytes(18).toString("base64url");
  const offer = {
    packageId: pkg?.id ?? "", name: pkg?.name ?? "", price: pkg?.price ?? "", includes: pkg?.includes ?? "",
    timelineDays: design.buildPlan.reduce((s, x) => s + (Number(x.days) || 0), 0), alsoSuggest, previewUrl: previewUrl(token),
  };
  await update(problemId, {
    design, offer, previewToken: token,
    solution: {
      summary: `${offer.name}: ${design.concept}`.slice(0, 300), rootCause: audit.report.headline, approach: design.concept,
      architecture: design.backend.architecture, steps: design.buildPlan.map((b) => `${b.phase} (${b.days}d): ${b.deliverable}`),
      stack: design.backend.stack, runningCost: design.backend.monthlyCost, risks: design.placeholders.length ? [`ناقص من الزبون: ${design.placeholders.join("، ")}`] : [],
      demoPlan: "homepage concept", sources: [],
    },
  });

  const outreach = await runAgent(ws, "outreach-writer", `رسالة: ${p.title}`.slice(0, 120), null, (h) =>
    ask(h, ws, brand, "outreach-writer",
      `${factsBlock(p, null, null)}
AUDIT HEADLINE: ${audit.report.headline}\nTOP ISSUES: ${audit.report.topIssues.map((i) => `${i.plain} (${i.impact})`).join(" · ")}
CONCEPT LINK (private, unlisted): ${offer.previewUrl}\nPACKAGE (for the owner, mention price only if natural): ${offer.name} ${offer.price}
Write ONE personal WhatsApp message to the clinic/business (in the language of their audience: ${audit.report.siteLanguage}), from the
owner, as a local professional: one measured fact about their site, what it likely costs them, that we already sketched a new homepage
for them (the link), and one low-commitment question. No shaming, no hype, under 90 words. Plus one follow-up. Channel: WhatsApp business
number${p.phone ? ` ${p.phone}` : ""} or the contact form/Instagram on their site. publicReply stays empty.`, OutreachOut),
  );
  await update(problemId, { outreach: { ...outreach, publicReply: "" }, status: "solved" });
  await log(ws, "web-designer", `عرض جاهز: ${p.title.slice(0, 50)} — التصميم والرسالة ناطرينك`);
}

/** Google Places terms: only place_id may be cached. Clear other Google fields after 30 days unless the owner is talking to them. */
export async function purgeGoogleData(workspaceId?: string) {
  const conds = [eq(problems.kind, "opportunity"), isNotNull(problems.googleExpiresAt), lt(problems.googleExpiresAt, new Date()),
    notInArray(problems.status, ["contacted", "replied", "won"])];
  if (workspaceId) conds.push(eq(problems.workspaceId, workspaceId));
  const rows = await db
    .update(problems)
    .set({
      phone: "", address: "", rating: null, reviews: null, votes: null, googleExpiresAt: null,
      title: sql`CASE WHEN ${problems.website} <> '' THEN regexp_replace(${problems.website}, '^https?://(www\\.)?([^/]+).*$', '\\2') ELSE 'Google place' END`,
      author: "", organization: "",
    })
    .where(and(...conds))
    .returning({ id: problems.id });
  return rows.length;
}

export const opportunityStats = (workspaceId: string) =>
  db
    .select({ status: problems.status, n: sql<number>`count(*)` })
    .from(problems)
    .where(and(eq(problems.workspaceId, workspaceId), eq(problems.kind, "opportunity")))
    .groupBy(problems.status);

