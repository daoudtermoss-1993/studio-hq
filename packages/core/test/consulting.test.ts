import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { brandProfiles, db, engagementInterviews, engagements, eq, jobs, memberships, pool, runMigrations, users, workspaces } from "@studio/db";
import {
  addInterview, chosenOpportunity, claimNext, complete, consultingSummary, createEngagement, enqueue, getEngagement, moneyOf, oppMath, paybackMonths,
  pilotResults, quadrantOf, recordPilotMetrics, redact, runJob, scoreOpportunities, setEngagementPrices, setEngagementStage, termsFor, updateOpportunity,
} from "../src";
import { mockOpportunities } from "../src/mock-consulting";

let wsId = "";
let engId = "";

async function drain(max = 40) {
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
  const [u] = await db.insert(users).values({ email: `cs${stamp}@test.dev`, name: "Cs", passwordHash: "x" }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Consulting", slug: `cs-${stamp}` }).returning();
  await db.insert(memberships).values({ userId: u.id, workspaceId: w.id });
  await db.insert(brandProfiles).values({ workspaceId: w.id, niche: "AI consulting", audience: "companies", platforms: ["linkedin"], pillars: ["حلول"] });
  wsId = w.id;
});

afterAll(async () => {
  await pool().end();
});

describe("the money is computed by code", () => {
  it("savings = tasks × minutes ÷ 60 × hourly cost, minus running cost; payback in months", () => {
    expect(oppMath({ tasksPerMonth: 3000, minutesSaved: 4, hourlyCost: 6, runningMonthly: 150, setupCost: 0 })).toEqual({ savingMonthly: 1200, netMonthly: 1050, netYearly: 12600 });
    expect(paybackMonths(8000, 1050)).toBe(7.6);
    expect(paybackMonths(8000, -10)).toBeNull();
    expect(moneyOf("$8,000")).toBe(8000);
    expect(moneyOf("$1,000/شهر")).toBe(1000);
  });

  it("quadrants and the first pilot: high value AND easy, never one with red flags", () => {
    expect(quadrantOf(5, 4)).toBe("start-here");
    expect(quadrantOf(5, 2)).toBe("later");
    expect(quadrantOf(2, 4)).toBe("small-win");
    expect(quadrantOf(2, 2)).toBe("avoid");
    const s = scoreOpportunities(mockOpportunities() as any, 8000);
    expect(s.recommended).toBe("support-drafts");
    expect(s.items.map((i) => i.quadrant)).toEqual(["start-here", "start-here", "later", "avoid"]);
    const flagged = mockOpportunities() as any;
    flagged.items[0].redFlags = ["ما في داتا"];
    expect(scoreOpportunities(flagged, 8000).recommended).toBe("outage-digest");
  });

  it("pilot results come from measured numbers only", () => {
    const metrics = [
      { key: "m", name: "min", unit: "min", kind: "minutes-per-task", higherIsBetter: false, howToMeasure: "", baseline: 9, current: 5 },
      { key: "v", name: "vol", unit: "n", kind: "tasks-per-month", higherIsBetter: true, howToMeasure: "", baseline: 3000, current: 3000 },
      { key: "a", name: "acc", unit: "%", kind: "other", higherIsBetter: true, howToMeasure: "", baseline: null, current: 70 },
    ] as any;
    const r = pilotResults(metrics, { inputs: { tasksPerMonth: 3000, minutesSaved: 4, hourlyCost: 6, runningMonthly: 150, setupCost: 0 }, savingMonthly: 1200 });
    expect(r.realizedMonthly).toBe(1200); // 3000 × 4 min ÷ 60 × $6
    expect(r.hitTarget).toBe(true);
    expect(r.metrics[0]).toMatchObject({ changePct: -44.4, improved: true });
    expect(r.metrics[2].changePct).toBeNull();
    expect(pilotResults(metrics.slice(2), null).realizedMonthly).toBeNull();
  });

  it("masks contact details but keeps amounts and dates", () => {
    const out = redact("Rami (rami@isp.com, +961 3 123 456) said 3000 tickets, $1200000 budget, on 2026-11-06, card 4111 1111 1111 1111");
    expect(out).not.toMatch(/rami@|123 456|4111/);
    expect(out).toContain("3000 tickets");
    expect(out).toContain("$1200000");
    expect(out).toContain("2026-11-06");
  });

  it("payment terms are fixed by the method, in the client's language", () => {
    expect(termsFor("assessment", "Lebanese Arabic")[0]).toBe("50% عند التوقيع");
    expect(termsFor("pilot", "English")).toEqual(["40% at the start", "30% when it runs in draft mode", "30% at delivery"]);
    expect(termsFor("pilot", "French")[2]).toBe("30% à la livraison");
  });
});

describe("consulting pipeline (mock AI, real DB)", () => {
  it("research → interviews → scored opportunities → proposals → demo → pilot → report", async () => {
    const e = await createEngagement(wsId, {
      company: "NetLine ISP", website: "netline.example", sector: "ISP", country: "Lebanon", size: "80", contactRole: "COO",
      market: "lebanon", notes: "COO Rami 03 123 456 says support is drowning",
    });
    engId = e.id;
    expect(e.notes).toContain("[number]"); // phone masked before saving
    await drain();
    let cur = await getEngagement(engId);
    expect(cur.research.firstCallQuestions.length).toBeGreaterThanOrEqual(3);

    await addInterview(engId, { role: "team", person: "مسؤول الدعم", notes: "3000 tickets a month, 9 minutes each. email: lead@netline.example" });
    await addInterview(engId, { role: "finance", person: "المالية", notes: "an hour of support costs about $6" });
    await drain();
    const ivs = await db.select().from(engagementInterviews).where(eq(engagementInterviews.engagementId, engId));
    expect(ivs).toHaveLength(2);
    expect(ivs.every((i) => i.synthesis)).toBe(true);
    expect(ivs.find((i) => i.role === "team")!.notes).toContain("[email]");

    await enqueue("map-opportunities", wsId, { engagementId: engId });
    await drain();
    cur = await getEngagement(engId);
    const opp = chosenOpportunity(cur)!;
    expect(opp.id).toBe("support-drafts");
    expect(opp.savingMonthly).toBe(1200);
    expect(opp.netMonthly).toBe(1050);
    expect(opp.paybackMonths).toBe(7.6); // default pilot price $8,000

    // the owner corrects an input: the money is recomputed by code, and the source becomes "owner"
    await updateOpportunity(engId, "support-drafts", { minutesSaved: 5 });
    cur = await getEngagement(engId);
    expect(chosenOpportunity(cur)).toMatchObject({ savingMonthly: 1500, netMonthly: 1350 });
    expect(chosenOpportunity(cur)!.inputSources.minutesSaved).toBe("owner");

    await setEngagementPrices(engId, { assessment: "$1,500", pilot: "$6,000" });
    await enqueue("write-proposal", wsId, { engagementId: engId, kind: "assessment" });
    await enqueue("write-proposal", wsId, { engagementId: engId, kind: "pilot" });
    await enqueue("build-demo", wsId, { engagementId: engId });
    await enqueue("plan-pilot", wsId, { engagementId: engId });
    await drain();
    cur = await getEngagement(engId);
    expect(cur.proposal.price).toBe("$1,500"); // the price is ours, never the model's
    expect(cur.proposal.terms[0]).toBe("50% عند التوقيع");
    expect(cur.pilotProposal.price).toBe("$6,000");
    expect(cur.demo.works).toBe(true);
    expect(cur.demo.oppId).toBe("support-drafts");
    expect(cur.review.verdict).toBeTruthy();
    expect(cur.pilot.metrics.map((m: any) => m.kind)).toEqual(expect.arrayContaining(["minutes-per-task", "tasks-per-month"]));

    await recordPilotMetrics(engId, { "minutes-per-ticket": { baseline: 9, current: 5 }, "tickets-per-month": { baseline: 3000, current: 3000 } });
    await enqueue("pilot-report", wsId, { engagementId: engId });
    await drain();
    cur = await getEngagement(engId);
    // measured 9 → 5 min = 4 saved: 3000 × 4 ÷ 60 × $6 = $1,200, below the $1,500 promised after the owner's edit
    expect(cur.pilotReport.results).toMatchObject({ realizedMonthly: 1200, promisedMonthly: 1500, hitTarget: false });
    expect(cur.pilotReport.headline).toContain("1200");

    await setEngagementStage(wsId, engId, "assessment", 1500);
    const sum = await consultingSummary(wsId);
    expect(sum.byStage.assessment).toBe(1);
    expect(sum.won).toBe(1500);
    await expect(setEngagementStage("someone-else", engId, "won" as any)).rejects.toThrow();
  });

  it("a pilot proposal needs a chosen opportunity", async () => {
    const [e] = await db.insert(engagements).values({ workspaceId: wsId, company: "Empty Co" }).returning();
    await expect(runJob({ type: "write-proposal", payload: { engagementId: e.id, kind: "pilot" } } as any)).rejects.toThrow(/choose a pilot/);
  });
});
