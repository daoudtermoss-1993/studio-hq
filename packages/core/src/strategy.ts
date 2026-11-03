import { and, count, dataImports, db, desc, eq, reels, strategyReports } from "@studio/db";
import { brandOf, latestStrategy } from "./helpers";
import { StrategyPlanOut } from "./schemas";
import { ask, log, runAgent } from "./team";

/** The CEO's growth & monetization plan per platform, for this brand's country and goals. */
export async function ceoStrategy(workspaceId: string) {
  const brand = await brandOf(workspaceId);
  const previous = await latestStrategy(workspaceId);
  const byStatus = await db.select({ status: reels.status, n: count() }).from(reels).where(eq(reels.workspaceId, workspaceId)).groupBy(reels.status);
  const results = await db
    .select({ number: reels.number, title: reels.title, results: reels.results, platforms: reels.platforms })
    .from(reels)
    .where(and(eq(reels.workspaceId, workspaceId), eq(reels.status, "posted")))
    .orderBy(desc(reels.number))
    .limit(15);
  const reports = await db
    .select({ result: dataImports.result })
    .from(dataImports)
    .where(and(eq(dataImports.workspaceId, workspaceId), eq(dataImports.kind, "metrics"), eq(dataImports.processed, true)))
    .orderBy(desc(dataImports.createdAt))
    .limit(3);

  const plan = await runAgent(workspaceId, "ceo", "خطة النمو والربح", null, (h) =>
    ask(h, workspaceId, brand, "ceo",
      `Write this week's growth & monetization plan.
Country: ${brand.country}. Platforms: ${brand.platforms.join(", ")}. Owner's goals: ${brand.goals || "grow and earn from content"}.
Presenter mode: ${brand.presenterMode}${brand.avatarId ? " (twin configured)" : ""}.
PIPELINE: ${JSON.stringify(byStatus)}
POSTED REELS WITH RESULTS: ${JSON.stringify(results)}
ANALYST REPORTS: ${JSON.stringify(reports.map((r) => r.result))}
PREVIOUS PLAN: ${previous ? JSON.stringify(previous.plan) : "none"}
For EACH platform: its role, the concrete monetization path available in ${brand.country} (verify with web search, say
"unknown" if you can't confirm), the next measurable milestone and this week's actions. Then the revenue streams in order,
the presenter policy (when the owner vs the digital twin should appear), the weekly focus, and the risks.`,
      StrategyPlanOut, { webSearch: true, extraSkills: ["monetization", "viral"], mockAs: "ceo-strategy" }),
  );
  await db.insert(strategyReports).values({ workspaceId, plan });
  await log(workspaceId, "ceo", `خطة الأسبوع: ${plan.weeklyFocus}`);
  return plan;
}

