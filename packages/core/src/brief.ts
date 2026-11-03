import { asc, brandProfiles, count, db, eq, and, lessons, reels, type ReelStatus } from "@studio/db";
import { localDate } from "./time";

export const PIPELINE: ReelStatus[] = ["idea", "scripted", "ready_to_record", "rendering", "recorded", "editing", "edited", "approved", "scheduled", "posted"];

export type NeedKind = "record" | "approve" | "answer" | "post" | "lessons";
export interface Need {
  kind: NeedKind;
  reelNumber?: number;
  reelId?: string;
  title: string;
  questionId?: string;
}

/** "Your part today": everything only the owner can do, most blocking first. */
export async function computeBrief(workspaceId: string) {
  const [brand] = await db.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, workspaceId));
  const tz = brand?.timezone ?? "UTC";
  const today = localDate(tz);
  const all = await db.select().from(reels).where(eq(reels.workspaceId, workspaceId)).orderBy(asc(reels.number));
  const needs: Need[] = [];

  for (const r of all.filter((r) => r.status === "ready_to_record")) needs.push({ kind: "record", reelNumber: r.number, reelId: r.id, title: r.title });
  for (const r of all.filter((r) => r.status === "edited")) needs.push({ kind: "approve", reelNumber: r.number, reelId: r.id, title: r.title });
  for (const r of all) {
    if (r.status === "posted" || r.status === "rejected") continue;
    for (const q of r.questions ?? []) if (!q.answer) needs.push({ kind: "answer", reelNumber: r.number, reelId: r.id, title: q.text, questionId: q.id });
  }
  for (const r of all.filter((r) => r.status === "scheduled" && r.publishAt && localDate(tz, r.publishAt) <= today)) {
    needs.push({ kind: "post", reelNumber: r.number, reelId: r.id, title: r.title });
  }
  const [{ n }] = await db.select({ n: count() }).from(lessons).where(and(eq(lessons.workspaceId, workspaceId), eq(lessons.status, "proposed")));
  if (Number(n)) needs.push({ kind: "lessons", title: String(n) });

  const pipeline = Object.fromEntries(PIPELINE.map((s) => [s, all.filter((r) => r.status === s).length])) as Record<ReelStatus, number>;
  const upcoming = all
    .filter((r) => r.status === "scheduled" && r.publishAt)
    .sort((a, b) => +a.publishAt! - +b.publishAt!)
    .slice(0, 5)
    .map((r) => ({ reelId: r.id, number: r.number, title: r.title, publishAt: r.publishAt!.toISOString() }));

  return { date: today, timezone: tz, needs, pipeline, upcoming };
}

export type Brief = Awaited<ReturnType<typeof computeBrief>>;
