import { randomUUID } from "node:crypto";
import { brandProfiles, db, desc, eq, reels, strategyReports, type BrandProfile, type Reel } from "@studio/db";

export interface Question {
  id: string;
  text: string;
  answer?: string;
}

export const qs = (r: Reel): Question[] => (Array.isArray(r.questions) ? r.questions : []);
export const newQ = (text: string): Question => ({ id: randomUUID().slice(0, 8), text });

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

export async function updateReel(reelId: string, patch: Partial<typeof reels.$inferInsert>): Promise<Reel> {
  const [r] = await db.update(reels).set(patch).where(eq(reels.id, reelId)).returning();
  return r;
}

export async function latestStrategy(workspaceId: string) {
  const [s] = await db.select().from(strategyReports).where(eq(strategyReports.workspaceId, workspaceId)).orderBy(desc(strategyReports.createdAt)).limit(1);
  return s ?? null;
}
