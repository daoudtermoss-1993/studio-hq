import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline as pipe } from "node:stream/promises";
import {
  and, asc, assets, brandProfiles, count, dataImports, db, desc, eq, gte, ideas, inArray, isNotNull, lessons,
  reels, retros, sql, trendReports, type BrandProfile, type Reel, type ReelStatus,
} from "@studio/db";
import { enqueue } from "./queue";
import {
  AnalystOut, CaptionsOut, ChangeRouteOut, CommunityOut, CoverOut, EditCheckOut, FactCheckOut,
  HooksOut, MeetingOut, RepurposeOut, ScriptOut, StrategyOut, TrendsOut, type Script,
} from "./schemas";
import { storage } from "./storage";
import { ask, log, runAgent } from "./team";
import { addDays, localDate, zonedToUtc } from "./time";
import { editReel, extractFrame, whisperLang } from "./video";

export interface Question {
  id: string;
  text: string;
  answer?: string;
}

const qs = (r: Reel): Question[] => (Array.isArray(r.questions) ? r.questions : []);
const newQ = (text: string): Question => ({ id: randomUUID().slice(0, 8), text });

export async function brandOf(workspaceId: string): Promise<BrandProfile> {
  const [b] = await db.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, workspaceId));
  if (!b) throw new Error("brand profile missing: finish onboarding first");
  return b;
}

export async function getReel(reelId: string): Promise<Reel> {
  const [r] = await db.select().from(reels).where(eq(reels.id, reelId));
  if (!r) throw new Error(`reel ${reelId} not found`);
  return r;
}

async function updateReel(reelId: string, patch: Partial<typeof reels.$inferInsert>): Promise<Reel> {
  const [r] = await db.update(reels).set(patch).where(eq(reels.id, reelId)).returning();
  return r;
}

const reelsWhere = (workspaceId: string, status: ReelStatus | ReelStatus[]) =>
  db
    .select()
    .from(reels)
    .where(and(eq(reels.workspaceId, workspaceId), Array.isArray(status) ? inArray(reels.status, status) : eq(reels.status, status)))
    .orderBy(asc(reels.number));

function answered(r: Reel) {
  const a = qs(r).filter((q) => q.answer);
  return a.length ? `\nOWNER'S ANSWERS\n${a.map((q) => `- Q: ${q.text}\n  A: ${q.answer}`).join("\n")}` : "";
}

// ------------------------------------------------------------------ ideas

export async function ensureTrends(workspaceId: string) {
  const brand = await brandOf(workspaceId);
  const date = localDate(brand.timezone);
  const [existing] = await db
    .select()
    .from(trendReports)
    .where(and(eq(trendReports.workspaceId, workspaceId), eq(trendReports.date, date)));
  if (existing) return existing.items;
  const recent = await db.select({ title: reels.title }).from(reels).where(eq(reels.workspaceId, workspaceId)).orderBy(desc(reels.number)).limit(20);
  return runAgent(workspaceId, "trend-scout", "ترندات اليوم", null, async (h) => {
    const out = await ask(h, workspaceId, brand, "trend-scout",
      `Today is ${date}. Find up to 8 trends for this brand from the last 72 hours.
Already covered (don't repeat): ${recent.map((r) => r.title).join(" | ") || "nothing yet"}`,
      TrendsOut, { webSearch: true });
    await db.insert(trendReports).values({ workspaceId, date, items: out.trends }).onConflictDoNothing();
    return out.trends;
  });
}

/** Strategist picks `count` ideas and opens a reel for each. Returns the new reel ids. */
export async function planReels(workspaceId: string, howMany: number): Promise<string[]> {
  if (howMany <= 0) return [];
  const brand = await brandOf(workspaceId);
  const trends = await ensureTrends(workspaceId);
  const backlog = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.workspaceId, workspaceId), eq(ideas.used, false)))
    .orderBy(desc(ideas.score))
    .limit(20);
  const recent = await db
    .select({ number: reels.number, title: reels.title, pillar: reels.pillar, results: reels.results })
    .from(reels)
    .where(eq(reels.workspaceId, workspaceId))
    .orderBy(desc(reels.number))
    .limit(10);
  const out = await runAgent(workspaceId, "content-strategist", `اختيار ${howMany} أفكار جديدة`, null, (h) =>
    ask(h, workspaceId, brand, "content-strategist",
      `Pick exactly ${howMany} ideas to produce now, balanced against the recent pillars.
TODAY'S TRENDS: ${JSON.stringify(trends)}
IDEA BACKLOG: ${JSON.stringify(backlog.map((i) => ({ pillar: i.pillar, text: i.text, angle: i.angle, score: i.score })))}
LAST REELS (newest first): ${JSON.stringify(recent)}
Also add up to 10 good new ideas to the backlog (newIdeas). For each pick, add questions only the owner can answer (personal story, opinion, demo).`,
      StrategyOut),
  );
  if (out.newIdeas.length) {
    await db.insert(ideas).values(out.newIdeas.map((i) => ({ workspaceId, pillar: i.pillar, text: i.text, angle: i.angle, source: i.source, score: i.score })));
  }
  const picks = out.picks.slice(0, howMany);
  return db.transaction(async (tx) => {
    // serialize numbering per workspace
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`);
    const [{ max }] = await tx
      .select({ max: sql<number | null>`max(${reels.number})` })
      .from(reels)
      .where(eq(reels.workspaceId, workspaceId));
    let n = Number(max ?? 0);
    const ids: string[] = [];
    for (const p of picks) {
      const [reel] = await tx
        .insert(reels)
        .values({
          workspaceId, number: ++n, title: p.title, pillar: p.pillar, angle: p.angle, source: p.source,
          platforms: brand.platforms, targetSeconds: brand.targetSeconds, questions: p.questions.map(newQ),
        })
        .returning({ id: reels.id });
      ids.push(reel.id);
    }
    return ids;
  });
}

// ------------------------------------------------------------------ writing

/** idea → hooks → script + teleprompter → fact-check → ready_to_record */
export async function writeReel(reelId: string) {
  let reel = await getReel(reelId);
  const ws = reel.workspaceId;
  const brand = await brandOf(ws);
  const brief = `REEL #${reel.number}: ${reel.title}\nPillar: ${reel.pillar}\nAngle: ${reel.angle}\nSource: ${reel.source}\nTarget length: ${reel.targetSeconds}s${answered(reel)}`;

  const hooks = await runAgent(ws, "hook-writer", `هوكات ريل ${reel.number}`, reel.id, (h) =>
    ask(h, ws, brand, "hook-writer", `${brief}\nWrite 5 hooks in different patterns and choose the best.`, HooksOut),
  );
  const chosen = hooks.hooks[Math.min(hooks.chosenIndex, hooks.hooks.length - 1)];
  reel = await updateReel(reel.id, { hooks, chosenHook: chosen.spoken });

  const script = await runAgent(ws, "scriptwriter", `سكربت ريل ${reel.number}`, reel.id, (h) =>
    ask(h, ws, brand, "scriptwriter",
      `${brief}\nCHOSEN HOOK: ${chosen.spoken} (on screen: ${chosen.onScreen})
Write timed beats and the teleprompter text. End with the CTA.`, ScriptOut),
  );
  reel = await updateReel(reel.id, {
    script, teleprompter: script.teleprompter, status: "scripted",
    questions: [...qs(reel), ...script.questions.map(newQ)],
  });

  const fc = await runAgent(ws, "fact-checker", `تدقيق ريل ${reel.number}`, reel.id, (h) =>
    ask(h, ws, brand, "fact-checker",
      `${brief}\nSCRIPT BEATS: ${JSON.stringify(script.beats)}\nTELEPROMPTER:\n${script.teleprompter}
Verify every factual claim. If something must change, return the revised teleprompter and beats.
Set blocking=true only for problems the owner must decide (legal, medical, red lines, unverifiable core claim).`,
      FactCheckOut, { webSearch: true }),
  );
  const next: Script = {
    ...script,
    ...(fc.revisedBeats?.length ? { beats: fc.revisedBeats } : {}),
    teleprompter: fc.revisedTeleprompter ?? script.teleprompter,
  };
  await updateReel(reel.id, {
    factCheck: fc, script: next, teleprompter: next.teleprompter,
    status: fc.blocking ? "scripted" : "ready_to_record",
    questions: [...qs(reel), ...(fc.blocking ? fc.issues.map(newQ) : [])],
  });
  await log(ws, "ceo", fc.blocking ? `ريل ${reel.number} ناطر جوابك قبل التسجيل` : `ريل ${reel.number} جاهز للتسجيل`);
}

// ------------------------------------------------------------------ recording & edit

export async function registerRecording(reelId: string, assetId: string) {
  const reel = await updateReel(reelId, { rawAssetId: assetId, status: "recorded" });
  await log(reel.workspaceId, "ceo", `وصل تسجيل ريل ${reel.number}`);
  await enqueue("process-recording", reel.workspaceId, { reelId }, { dedupeKey: `rec:${reelId}` });
}

async function writeCaptions(reel: Reel, brand: BrandProfile, transcript: string, instruction = "") {
  return runAgent(reel.workspaceId, "caption-writer", `كابشن ريل ${reel.number}`, reel.id, (h) =>
    ask(h, reel.workspaceId, brand, "caption-writer",
      `REEL #${reel.number}: ${reel.title}\nPlatforms: ${reel.platforms.join(", ")}\nHook: ${reel.chosenHook ?? ""}
WHAT WAS SAID: ${transcript || reel.teleprompter || ""}
${reel.captions ? `PREVIOUS CAPTIONS: ${JSON.stringify(reel.captions)}` : ""}
${instruction ? `OWNER'S CHANGE REQUEST: ${instruction}` : ""}
Write one caption per platform plus a first comment.`, CaptionsOut),
  );
}

async function saveFile(reel: Reel, kind: string, file: string, mime: string) {
  const key = `${reel.workspaceId}/reels/${reel.number}/${kind}-${Date.now()}${path.extname(file)}`;
  const size = await storage().put(key, createReadStream(file), mime);
  const [a] = await db.insert(assets).values({ workspaceId: reel.workspaceId, reelId: reel.id, kind, key, mime, size }).returning();
  return a.id;
}

async function designCover(reel: Reel, brand: BrandProfile, finalPath: string | null, tmp: string, instruction = "") {
  return runAgent(reel.workspaceId, "cover-designer", `غلاف ريل ${reel.number}`, reel.id, async (h) => {
    const cover = await ask(h, reel.workspaceId, brand, "cover-designer",
      `REEL #${reel.number}: ${reel.title}\nHook: ${reel.chosenHook ?? ""}\nBEATS: ${JSON.stringify(reel.script?.beats ?? [])}
${instruction ? `OWNER'S CHANGE REQUEST: ${instruction}` : ""}
Choose the cover text, the best frame second (a strong expression early in the video) and write the image brief.`, CoverOut);
    let assetId: string | null = reel.cover?.assetId ?? null;
    if (finalPath) {
      await h.setTool("Bash · ffmpeg frame");
      const out = path.join(tmp, "cover.jpg");
      try {
        await extractFrame(finalPath, cover.frameSecond, out);
        assetId = await saveFile(reel, "cover", out, "image/jpeg");
      } catch {
        /* a missing frame is not fatal */
      }
    }
    return { ...cover, assetId };
  });
}

export interface EditOptions {
  trimStart?: number;
  trimEnd?: number;
  noSubtitles?: boolean;
  captionNote?: string;
  coverNote?: string;
}

/** recorded → auto-edit (+ check) → captions & cover in parallel → edited */
export async function processRecording(reelId: string, opts: EditOptions = {}) {
  let reel = await getReel(reelId);
  if (!reel.rawAssetId) throw new Error(`reel ${reel.number} has no recording`);
  const ws = reel.workspaceId;
  const brand = await brandOf(ws);
  const [raw] = await db.select().from(assets).where(eq(assets.id, reel.rawAssetId));
  if (!raw) throw new Error("recording asset missing");
  await updateReel(reelId, { status: "editing" });
  const tmp = await mkdtemp(path.join(tmpdir(), "studio-edit-"));
  try {
    const input = path.join(tmp, `raw${path.extname(raw.key) || ".mp4"}`);
    await pipe(await storage().read(raw.key), createWriteStream(input));
    const outDir = path.join(tmp, "out");

    const report = await runAgent(ws, "video-editor", `مونتاج ريل ${reel.number}`, reel.id, async (h) => {
      await h.setTool("Bash · edit_reel.py");
      return editReel(input, outDir, { lang: whisperLang(brand.language), ...opts });
    });
    const finalPath = path.join(outDir, "final.mp4");
    const finalAssetId = await saveFile(reel, "final", finalPath, "video/mp4");
    const srtPath = path.join(outDir, "captions.srt");
    if (existsSync(srtPath)) await saveFile(reel, "srt", srtPath, "application/x-subrip");

    const check = report.transcript
      ? await runAgent(ws, "video-editor", `مراجعة مونتاج ريل ${reel.number}`, reel.id, (h) =>
          ask(h, ws, brand, "video-editor",
            `TARGET: ${reel.targetSeconds}s. FINAL DURATION: ${report.duration_out}s (removed ${report.removed_seconds}s of silence).
TELEPROMPTER:\n${reel.teleprompter ?? ""}\nTRANSCRIPT OF THE EDIT:\n${report.transcript}
List missing lines, say if a retake is needed, and give short notes.`, EditCheckOut, { tier: "fast" }),
        )
      : { missingLines: [], retakeNeeded: false, notes: report.warnings.join(" · ") || "no transcript available" };

    reel = await updateReel(reelId, { finalAssetId, editReport: { ...report, check } });
    const [captions, cover] = await Promise.all([
      writeCaptions(reel, brand, report.transcript ?? "", opts.captionNote),
      designCover(reel, brand, finalPath, tmp, opts.coverNote),
    ]);
    reel = await getReel(reelId);
    await updateReel(reelId, {
      captions, cover, status: "edited",
      questions: [...qs(reel), ...(check.retakeNeeded ? [newQ(`لازم تعيد تسجيل: ${check.missingLines.join(" / ") || check.notes}`)] : [])],
    });
    await log(ws, "ceo", `مونتاج ريل ${reel.number} جاهز، ناطر موافقتك`);
  } catch (err) {
    await updateReel(reelId, { status: "recorded" });
    throw err;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ approval & scheduling

export async function nextSlot(workspaceId: string, brand: BrandProfile) {
  const gap = Math.max(1, Math.floor(7 / Math.max(1, brand.reelsPerWeek)));
  const today = localDate(brand.timezone);
  const [last] = await db
    .select({ publishAt: reels.publishAt })
    .from(reels)
    .where(and(eq(reels.workspaceId, workspaceId), isNotNull(reels.publishAt), inArray(reels.status, ["scheduled", "posted"])))
    .orderBy(desc(reels.publishAt))
    .limit(1);
  let day = addDays(today, 1);
  if (last?.publishAt) {
    const candidate = addDays(localDate(brand.timezone, last.publishAt), gap);
    if (candidate > day) day = candidate;
  }
  return zonedToUtc(day, brand.postingTime, brand.timezone);
}

async function schedule(reel: Reel, brand: BrandProfile) {
  const publishAt = await runAgent(reel.workspaceId, "scheduler", `جدولة ريل ${reel.number}`, reel.id, async (h) => {
    await h.setTool("Calendar");
    return nextSlot(reel.workspaceId, brand);
  });
  const repurpose = await runAgent(reel.workspaceId, "repurposer", `تدوير ريل ${reel.number}`, reel.id, (h) =>
    ask(h, reel.workspaceId, brand, "repurposer",
      `REEL #${reel.number}: ${reel.title}\nSCRIPT: ${JSON.stringify(reel.script?.beats ?? [])}
VERIFIED FACTS: ${JSON.stringify(reel.factCheck?.claims ?? [])}
Write the carousel, post, thread and YouTube Shorts title/description.`, RepurposeOut),
  );
  await updateReel(reel.id, { publishAt, repurpose, status: "scheduled" });
  await log(reel.workspaceId, "scheduler", `ريل ${reel.number} مجدول`);
}

/** Owner approval. With `changes`, the CEO routes them to the right agents; without, the reel is scheduled. */
export async function approveReel(reelId: string, changes?: string) {
  const reel = await getReel(reelId);
  const brand = await brandOf(reel.workspaceId);
  if (!changes?.trim()) {
    const approved = await updateReel(reelId, { status: "approved" });
    await schedule(approved, brand);
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  await updateReel(reelId, { notes: `${reel.notes}\n[${stamp}] طلب تعديل: ${changes.trim()}`.trim() });
  const route = await runAgent(reel.workspaceId, "ceo", `توجيه تعديلات ريل ${reel.number}`, reel.id, (h) =>
    ask(h, reel.workspaceId, brand, "ceo",
      `The owner reviewed the edit of reel #${reel.number} and asked: "${changes}".
Route it: captions instruction, cover instruction, video re-edit (trim seconds at start/end, or no subtitles), or a retake (what to re-record).
Set null for anything not requested.`, ChangeRouteOut, { tier: "fast", mockAs: "change-router" }),
  );
  if (route.retake) {
    await updateReel(reelId, { status: "ready_to_record", questions: [...qs(reel), newQ(`إعادة تسجيل: ${route.retake}`)] });
    return;
  }
  if (route.video) {
    await processRecording(reelId, {
      trimStart: route.video.trimStart, trimEnd: route.video.trimEnd, noSubtitles: route.video.noSubtitles,
      captionNote: route.captions ?? undefined, coverNote: route.cover ?? undefined,
    });
    return;
  }
  const fresh = await getReel(reelId);
  const transcript = fresh.editReport?.transcript ?? "";
  const [captions, cover] = await Promise.all([
    route.captions ? writeCaptions(fresh, brand, transcript, route.captions) : Promise.resolve(null),
    route.cover ? designCover(fresh, brand, null, tmpdir(), route.cover) : Promise.resolve(null),
  ]);
  await updateReel(reelId, { ...(captions ? { captions } : {}), ...(cover ? { cover } : {}) });
  await log(reel.workspaceId, "ceo", `تعديلات ريل ${reel.number} جاهزة`);
}

export async function markPosted(reelId: string) {
  const r = await updateReel(reelId, { status: "posted" });
  await log(r.workspaceId, "ceo", `ريل ${r.number} انشر 🎉`);
}

// ------------------------------------------------------------------ owner answers

export async function answerQuestion(reelId: string, questionId: string, answer: string) {
  const reel = await getReel(reelId);
  const list = qs(reel).map((q) => (q.id === questionId ? { ...q, answer: answer.trim() } : q));
  await updateReel(reelId, { questions: list });
  if (!list.some((q) => !q.answer) && (reel.status === "idea" || reel.status === "scripted")) {
    await enqueue("write-reel", reel.workspaceId, { reelId }, { dedupeKey: `write:${reelId}` });
  }
}

// ------------------------------------------------------------------ daily loop & weekly meeting

/** The CEO's daily loop: edit new recordings, schedule approvals, keep the script buffer full, read imports. */
export async function dailyRun(workspaceId: string) {
  const brand = await brandOf(workspaceId);
  await runAgent(workspaceId, "ceo", "شغل اليوم", null, async (h) => {
    await h.setTool("Planning");
    for (const r of await reelsWhere(workspaceId, "recorded")) if (r.rawAssetId) await processRecording(r.id);
    for (const r of await reelsWhere(workspaceId, "approved")) await schedule(r, brand);
    for (const r of await reelsWhere(workspaceId, "idea")) await writeReel(r.id);

    const [{ n }] = await db
      .select({ n: count() })
      .from(reels)
      .where(and(eq(reels.workspaceId, workspaceId), inArray(reels.status, ["ready_to_record", "scripted"])));
    const missing = brand.buffer - Number(n);
    if (missing > 0) for (const id of await planReels(workspaceId, missing)) await writeReel(id);

    const pending = await db.select().from(dataImports).where(and(eq(dataImports.workspaceId, workspaceId), eq(dataImports.processed, false)));
    for (const i of pending) await analyzeImport(i.id);
  });
}

export async function weeklyMeeting(workspaceId: string) {
  const brand = await brandOf(workspaceId);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const week = await db.select().from(reels).where(and(eq(reels.workspaceId, workspaceId), gte(reels.updatedAt, since))).orderBy(asc(reels.number));
  const reports = await db
    .select({ result: dataImports.result })
    .from(dataImports)
    .where(and(eq(dataImports.workspaceId, workspaceId), gte(dataImports.createdAt, since), eq(dataImports.processed, true)));
  const known = await db
    .select({ skill: lessons.skill, text: lessons.text })
    .from(lessons)
    .where(and(eq(lessons.workspaceId, workspaceId), inArray(lessons.status, ["approved", "proposed"])));
  const evidence = week.map((r) => ({
    number: r.number, title: r.title, status: r.status, pillar: r.pillar, hook: r.chosenHook, results: r.results,
    changeRequests: r.notes, factIssues: (r.factCheck?.claims ?? []).filter((c: any) => !c.ok), editCheck: r.editReport?.check ?? null,
  }));
  const out = await runAgent(workspaceId, "ceo", "الاجتماع الأسبوعي", null, (h) =>
    ask(h, workspaceId, brand, "ceo",
      `Weekly meeting. Learn from this week's evidence and propose at most 10 one-line rules, each with evidence
(reel numbers, metric, or correction) and the skill it belongs to. Don't repeat existing lessons.
THIS WEEK'S REELS: ${JSON.stringify(evidence)}
ANALYST REPORTS: ${JSON.stringify(reports.map((r) => r.result))}
EXISTING LESSONS: ${JSON.stringify(known)}`, MeetingOut, { mockAs: "ceo-meeting" }),
  );
  if (out.lessons.length) {
    await db.insert(lessons).values(out.lessons.map((l) => ({ workspaceId, skill: l.skill, text: l.text, evidence: l.evidence })));
  }
  await db.insert(retros).values({ workspaceId, summary: `${out.summary}\nالأسبوع الجاي: ${out.nextWeekFocus}` });
  await log(workspaceId, "ceo", `خلص الاجتماع: ${out.lessons.length} دروس ناطرة موافقتك`);
}

export async function analyzeImport(importId: string) {
  const [imp] = await db.select().from(dataImports).where(eq(dataImports.id, importId));
  if (!imp || imp.processed) return;
  const ws = imp.workspaceId;
  const brand = await brandOf(ws);
  const published = await reelsWhere(ws, ["scheduled", "posted"]);
  const reelList = published
    .map((r) => `#${r.number} | ${r.title} | ${r.publishAt?.toISOString() ?? "-"} | ${String(r.captions?.captions?.[0]?.text ?? "").slice(0, 80)}`)
    .join("\n");
  const content = imp.content.slice(0, 60_000);

  if (imp.kind === "metrics") {
    const out = await runAgent(ws, "analyst", `تحليل ${imp.filename}`, null, (h) =>
      ask(h, ws, brand, "analyst",
        `Match the exported rows to our reels (by publish date, caption start or URL) and extract the numbers.
OUR REELS:\n${reelList}\nEXPORT (${imp.filename}):\n${content}`, AnalystOut),
    );
    for (const row of out.reels) {
      const reel = published.find((r) => r.number === row.number);
      if (reel) await updateReel(reel.id, { results: row });
    }
    await db.update(dataImports).set({ processed: true, result: out }).where(eq(dataImports.id, importId));
  } else {
    const out = await runAgent(ws, "community-manager", `تعليقات ${imp.filename}`, null, (h) =>
      ask(h, ws, brand, "community-manager",
        `Draft replies, the keyword-DM list (keyword: "${brand.ctaKeyword}") and ideas from recurring questions.
OUR REELS:\n${reelList}\nCOMMENTS (${imp.filename}):\n${content}`, CommunityOut),
    );
    if (out.ideas.length) await db.insert(ideas).values(out.ideas.map((text) => ({ workspaceId: ws, text, source: "comments", score: 10 })));
    await db.update(dataImports).set({ processed: true, result: out }).where(eq(dataImports.id, importId));
  }
}
