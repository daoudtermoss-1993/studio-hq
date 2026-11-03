import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentRuns, and, assets, brandProfiles, db, eq, jobs, lessons, memberships, pool, reels, runMigrations, sql, strategyReports, users,
  viralFinds, workspaces,
} from "@studio/db";
import {
  addViralLink, adoptViral, approveReel, claimNext, complete, computeBrief, dailyRun, enqueue, levelOf, nextSlot, officeState,
  registerRecording, rejectReel, runJob, storage, weeklyMeeting, writeReel, zonedToUtc,
} from "../src";

let wsId = "";

/** 8 s talking-head stand-in: 3 s tone, 2 s silence, 3 s tone (so the editor has silence to cut). */
function sampleVideo() {
  const dir = mkdtempSync(path.join(tmpdir(), "studio-test-"));
  const out = path.join(dir, "raw.mp4");
  execFileSync("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30:duration=8",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
    "-af", "volume='if(between(t,3,5),0,1)':eval=frame",
    "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", out,
  ]);
  return out;
}

async function drain() {
  for (let i = 0; i < 20; i++) {
    const job = await claimNext();
    if (!job) return;
    await runJob(job);
    await complete(job);
  }
}

beforeAll(async () => {
  await runMigrations();
  await db.execute(sql`TRUNCATE users, workspaces, jobs RESTART IDENTITY CASCADE`);
  const [u] = await db.insert(users).values({ email: "t@test.dev", name: "Test", passwordHash: "x" }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Test Studio", slug: "test-studio" }).returning();
  await db.insert(memberships).values({ userId: u.id, workspaceId: w.id });
  await db.insert(brandProfiles).values({
    workspaceId: w.id, niche: "AI tools", audience: "Arab professionals", platforms: ["instagram", "tiktok"],
    pillars: ["أدوات", "قصص"], buffer: 2, reelsPerWeek: 3, ctaKeyword: "مدير", ctaReward: "the prompt",
  });
  wsId = w.id;
});

afterAll(async () => {
  await pool().end();
});

describe("time helpers", () => {
  it("converts Beirut wall-clock to UTC", () => {
    expect(zonedToUtc("2026-11-04", "19:30", "Asia/Beirut").toISOString()).toBe("2026-11-04T17:30:00.000Z");
  });
  it("computes levels", () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(80).level).toBe(3);
    expect(levelOf(5000).titleEn).toBe("Legend");
  });
});

describe("full reel lifecycle (mock AI, real DB, real ffmpeg)", () => {
  it("daily run fills the buffer with ready-to-record reels", async () => {
    await dailyRun(wsId);
    const ready = await db.select().from(reels).where(and(eq(reels.workspaceId, wsId), eq(reels.status, "ready_to_record")));
    expect(ready).toHaveLength(2);
    expect(ready[0].teleprompter).toBeTruthy();
    expect(ready[0].chosenHook).toBeTruthy();
    const brief = await computeBrief(wsId);
    expect(brief.needs.filter((n) => n.kind === "record")).toHaveLength(2);
  });

  it("the CEO wrote a platform strategy and every reel has a decision", async () => {
    const [plan] = await db.select().from(strategyReports).where(eq(strategyReports.workspaceId, wsId));
    expect(plan.plan.platforms.length).toBeGreaterThan(0);
    const all = await db.select().from(reels).where(eq(reels.workspaceId, wsId));
    for (const r of all) {
      expect(r.decision?.goal).toBeTruthy();
      expect(r.decision?.platforms?.length).toBeGreaterThan(0);
    }
  });

  it("viral hunter found and analyzed videos; one became a reel of ours", async () => {
    const finds = await db.select().from(viralFinds).where(eq(viralFinds.workspaceId, wsId));
    expect(finds.length).toBeGreaterThanOrEqual(4);
    expect(finds.some((f) => f.source === "youtube-api" && (f.velocity ?? 0) > 0)).toBe(true);
    expect(finds.filter((f) => f.analysis).length).toBeGreaterThan(0);
    const adopted = finds.filter((f) => f.status === "adopted");
    expect(adopted.length).toBeGreaterThan(0);
    const [r] = await db.select().from(reels).where(eq(reels.id, adopted[0].reelId!));
    expect(r.viralId).toBe(adopted[0].id);
    expect(r.source).toBe(adopted[0].url);
  });

  it("a second daily run does not over-produce", async () => {
    await dailyRun(wsId);
    const all = await db.select().from(reels).where(eq(reels.workspaceId, wsId));
    expect(all).toHaveLength(2);
  });

  it("a recording is edited, captioned and covered by the worker", async () => {
    const [reel] = await db.select().from(reels).where(and(eq(reels.workspaceId, wsId), eq(reels.number, 1)));
    const key = `${wsId}/reels/1/raw-test.mp4`;
    const size = await storage().put(key, readFileSync(sampleVideo()), "video/mp4");
    const [a] = await db.insert(assets).values({ workspaceId: wsId, reelId: reel.id, kind: "raw", key, mime: "video/mp4", size }).returning();
    await registerRecording(reel.id, a.id);
    await drain();
    const [edited] = await db.select().from(reels).where(eq(reels.id, reel.id));
    expect(edited.status).toBe("edited");
    expect(edited.finalAssetId).toBeTruthy();
    expect(edited.editReport.removed_seconds).toBeGreaterThan(1);
    expect(edited.captions.captions.length).toBeGreaterThan(0);
    expect(edited.cover.assetId).toBeTruthy();
  });

  it("change requests are routed (trim → re-edit) and approval schedules the reel", async () => {
    const [reel] = await db.select().from(reels).where(and(eq(reels.workspaceId, wsId), eq(reels.number, 1)));
    await approveReel(reel.id, "قص أول نص ثانية");
    const [again] = await db.select().from(reels).where(eq(reels.id, reel.id));
    expect(again.status).toBe("edited");
    expect(again.editReport.trimmed).toEqual([0.5, 0]);
    expect(again.notes).toContain("طلب تعديل");

    await approveReel(reel.id);
    const [scheduled] = await db.select().from(reels).where(eq(reels.id, reel.id));
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.publishAt).toBeTruthy();
    expect(scheduled.repurpose.carousel.length).toBeGreaterThan(2);
  });

  it("the next slot respects the rhythm", async () => {
    const [b] = await db.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, wsId));
    const [first] = await db.select().from(reels).where(and(eq(reels.workspaceId, wsId), eq(reels.number, 1)));
    const next = await nextSlot(wsId, b);
    expect((+next - +first.publishAt!) / 86_400_000).toBeCloseTo(2, 0);
  });

  it("the digital twin presents a reel: render → edit → needs approval, flagged as AI", async () => {
    await db.update(brandProfiles).set({ presenterMode: "avatar" }).where(eq(brandProfiles.workspaceId, wsId));
    const f = await addViralLink(wsId, "https://www.tiktok.com/@someone/video/123", "manual find");
    await drain(); // analyze-viral
    const reel = await adoptViral(f!.id);
    expect(reel?.presenter).toBe("avatar");
    await writeReel(reel!.id);
    await drain(); // render-avatar → process-recording
    const [done] = await db.select().from(reels).where(eq(reels.id, reel!.id));
    expect(done.status).toBe("edited");
    expect(done.aiGenerated).toBe(true);
    expect(done.finalAssetId).toBeTruthy();
    await db.update(brandProfiles).set({ presenterMode: "self" }).where(eq(brandProfiles.workspaceId, wsId));
  });

  it("the owner can reject a reel; it leaves the brief", async () => {
    const [r] = await db.select().from(reels).where(and(eq(reels.workspaceId, wsId), eq(reels.status, "edited")));
    await rejectReel(r.id, "الموضوع مش لجمهوري");
    const [after] = await db.select().from(reels).where(eq(reels.id, r.id));
    expect(after.status).toBe("rejected");
    expect(after.notes).toContain("مرفوض");
    const brief = await computeBrief(wsId);
    expect(brief.needs.some((n) => n.reelId === r.id)).toBe(false);
  });

  it("weekly meeting proposes lessons; approving them levels the team up", async () => {
    const before = await officeState(wsId);
    await weeklyMeeting(wsId);
    const proposed = await db.select().from(lessons).where(eq(lessons.workspaceId, wsId));
    expect(proposed.length).toBe(2);
    await db.update(lessons).set({ status: "approved" }).where(eq(lessons.workspaceId, wsId));
    const after = await officeState(wsId);
    const writer = (s: typeof after) => s.agents.find((a) => a.id === "scriptwriter")!;
    expect(writer(after).xp).toBe(writer(before).xp + 15);
    expect(after.library.lessons).toBe(2);
    expect(after.activity.length).toBeGreaterThan(5);
  });

  it("every agent run finished cleanly", async () => {
    const failed = await db.select().from(agentRuns).where(and(eq(agentRuns.workspaceId, wsId), eq(agentRuns.status, "failed")));
    expect(failed).toHaveLength(0);
  });

  it("jobs of one workspace never run concurrently", async () => {
    await db.update(jobs).set({ status: "done" });
    await enqueue("write-reel", wsId, { reelId: "a" });
    await enqueue("write-reel", wsId, { reelId: "b" });
    const first = await claimNext();
    expect(first).not.toBeNull();
    expect(await claimNext()).toBeNull();
    await complete(first!);
    expect(await claimNext()).not.toBeNull();
    await db.update(jobs).set({ status: "done" });
  });

  it("cron jobs are enqueued once per day", async () => {
    const a = await enqueue("daily-run", wsId, {}, { dedupeKey: "daily:2026-11-03", once: true });
    await db.update(jobs).set({ status: "done" }).where(eq(jobs.id, a.id));
    const b = await enqueue("daily-run", wsId, {}, { dedupeKey: "daily:2026-11-03", once: true });
    expect(b.id).toBe(a.id);
  });
});
