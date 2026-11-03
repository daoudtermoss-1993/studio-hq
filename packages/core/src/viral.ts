import { and, db, desc, eq, gte, inArray, reels, sql, viralFinds, type ViralFind } from "@studio/db";
import { brandOf } from "./helpers";
import { enqueue } from "./queue";
import { ViralAnalysisOut, ViralHuntOut } from "./schemas";
import { ask, log, runAgent } from "./team";
import { localDate } from "./time";
import { youtubeViral } from "./youtube";
import { whisperLang } from "./video";

const platformOf = (url: string) =>
  /tiktok\.com/.test(url) ? "tiktok" : /instagram\.com/.test(url) ? "instagram" : /youtu\.?be/.test(url) ? "youtube" : /facebook\.com|fb\.watch/.test(url) ? "facebook" : "other";

const score = (f: Pick<ViralFind, "velocity" | "outlier" | "views">) => (f.velocity ?? 0) * Math.max(1, f.outlier ?? 1) + (f.views ?? 0) / 100;

/** Daily: the hunter searches the web (TikTok/Instagram/YouTube) and the YouTube API, then the best finds get analyzed. */
export async function huntViral(workspaceId: string) {
  const brand = await brandOf(workspaceId);
  const today = localDate(brand.timezone);
  const since = new Date(Date.now() - 20 * 3_600_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(viralFinds)
    .where(and(eq(viralFinds.workspaceId, workspaceId), gte(viralFinds.createdAt, since), inArray(viralFinds.source, ["web", "youtube-api"])));
  if (Number(n) > 0) return;

  const inserted = await runAgent(workspaceId, "viral-hunter", "الفيديوهات المنتشرة اليوم", null, async (h) => {
    const out = await ask(h, workspaceId, brand, "viral-hunter",
      `Today is ${today}. Find up to 10 short videos (Shorts / TikTok / Reels) that are spreading fast in the last 7 days
in this niche or an adjacent one, for this audience and country (${brand.country}). Give the exact public URL, the creator,
the reported views and creator followers when visible, and why you picked it. Also give up to 4 YouTube search queries
(in English and in the audience's language) that would surface similar videos.`,
      ViralHuntOut, { webSearch: true });
    await h.setTool("YouTube Data API");
    const yt = await youtubeViral(out.youtubeQueries, { regionCode: brand.country, language: whisperLang(brand.language), days: 7 }).catch(
      async (e) => {
        await log(workspaceId, "viral-hunter", `YouTube API: ${String(e.message).slice(0, 120)}`);
        return [];
      },
    );
    const now = Date.now();
    const rows = [
      ...yt.map((f) => ({ ...f, source: "youtube-api" })),
      ...out.finds.map((f) => {
        const publishedAt = f.publishedAt && !Number.isNaN(Date.parse(f.publishedAt)) ? new Date(f.publishedAt) : null;
        const hours = publishedAt ? Math.max(1, (now - +publishedAt) / 3_600_000) : null;
        return {
          platform: f.platform, url: f.url, title: f.title, creator: f.creator, views: f.views, likes: null, comments: null,
          creatorFollowers: f.creatorFollowers, publishedAt,
          velocity: f.views && hours ? Math.round(f.views / hours) : null,
          outlier: f.views && f.creatorFollowers ? Math.round(f.views / Math.max(1000, f.creatorFollowers)) : null,
          description: `${f.description}${f.whyPicked ? ` — ${f.whyPicked}` : ""}`, source: "web",
        };
      }),
    ].filter((r) => /^https?:\/\//.test(r.url));
    if (!rows.length) return [];
    const clamp = (v: number | null | undefined) => (v == null ? null : Math.min(2_000_000_000, Math.round(v)));
    return db
      .insert(viralFinds)
      .values(rows.map((r) => ({
        workspaceId, platform: r.platform, url: r.url, title: r.title.slice(0, 300), creator: r.creator, views: clamp(r.views),
        likes: clamp(r.likes), comments: clamp(r.comments), creatorFollowers: clamp(r.creatorFollowers), publishedAt: r.publishedAt,
        velocity: clamp(r.velocity), outlier: clamp(r.outlier), description: r.description, source: r.source,
      })))
      .onConflictDoNothing()
      .returning();
  });
  const top = [...inserted].sort((a, b) => score(b) - score(a)).slice(0, 5);
  for (const f of top) await analyzeViral(f.id);
}

export async function addViralLink(workspaceId: string, url: string, note = "") {
  const [f] = await db
    .insert(viralFinds)
    .values({ workspaceId, url: url.trim(), platform: platformOf(url), source: "manual", description: note.slice(0, 2000) })
    .onConflictDoNothing()
    .returning();
  if (f) await enqueue("analyze-viral", workspaceId, { findId: f.id });
  return f ?? null;
}

/** Why did it work, and what is OUR original version of it. */
export async function analyzeViral(findId: string) {
  const [f] = await db.select().from(viralFinds).where(eq(viralFinds.id, findId));
  if (!f) return;
  const brand = await brandOf(f.workspaceId);
  const analysis = await runAgent(f.workspaceId, "viral-analyst", `تحليل: ${f.title || f.url}`.slice(0, 120), null, (h) =>
    ask(h, f.workspaceId, brand, "viral-analyst",
      `REFERENCE VIDEO (${f.platform}): ${f.url}
Title: ${f.title}\nCreator: ${f.creator}\nViews: ${f.views ?? "?"} · creator followers: ${f.creatorFollowers ?? "?"} · velocity/h: ${f.velocity ?? "?"}
Notes: ${f.description}
Look up the page if you can. Explain why it spread (hook, timed structure, pacing, emotion, format, audience signal),
rate how well it fits our brand (0-10), and design OUR original remake: new title, angle, our twist and a beat outline.
Also suggest a Stitch/Remix reaction idea. Never reuse their footage or wording.`,
      ViralAnalysisOut, { webSearch: true }),
  );
  await db.update(viralFinds).set({ analysis, status: "analyzed" }).where(eq(viralFinds.id, findId));
}

/** Turns an analyzed reference into a new reel of ours (used by the owner's button or by the strategist). */
export async function adoptViral(findId: string, decision?: Record<string, unknown>) {
  const [f] = await db.select().from(viralFinds).where(eq(viralFinds.id, findId));
  if (!f?.analysis || f.status === "adopted") return null;
  const brand = await brandOf(f.workspaceId);
  const a = f.analysis;
  const reel = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${f.workspaceId}))`);
    const [{ max }] = await tx.select({ max: sql<number | null>`max(${reels.number})` }).from(reels).where(eq(reels.workspaceId, f.workspaceId));
    const presenter = brand.presenterMode === "avatar" ? "avatar" : "self";
    const [r] = await tx
      .insert(reels)
      .values({
        workspaceId: f.workspaceId, number: Number(max ?? 0) + 1, title: a.remake.title, angle: `${a.remake.angle} — ${a.remake.ourTwist}`,
        source: f.url, pillar: "", platforms: brand.platforms, targetSeconds: brand.targetSeconds, viralId: f.id, presenter,
        questions: [], decision: decision ?? { why: a.whyItWorks.join(" · "), goal: "reach", presenter, platforms: brand.platforms, monetization: "", viral: f.url },
      })
      .returning();
    await tx.update(viralFinds).set({ status: "adopted", reelId: r.id }).where(eq(viralFinds.id, f.id));
    return r;
  });
  await log(f.workspaceId, "content-strategist", `ريل ${reel.number} مستوحى من فيديو منتشر`);
  return reel;
}

export async function dismissViral(findId: string) {
  await db.update(viralFinds).set({ status: "dismissed" }).where(eq(viralFinds.id, findId));
}

export async function viralCandidates(workspaceId: string, limit = 6) {
  return db
    .select()
    .from(viralFinds)
    .where(and(eq(viralFinds.workspaceId, workspaceId), eq(viralFinds.status, "analyzed")))
    .orderBy(desc(viralFinds.createdAt))
    .limit(limit);
}

