import { activities, agentRuns, and, count, db, desc, eq, gte, lessons, retros } from "@studio/db";
import { AGENTS } from "./agents";
import { computeBrief } from "./brief";
import { levelOf, XP_PER_LESSON, XP_PER_TASK } from "./levels";

/** Everything the live office needs in one call (polled by the dashboard). */
export async function officeState(workspaceId: string) {
  const since = new Date(Date.now() - 2 * 3_600_000);
  const [running, doneCounts, lessonCounts, recent, brief, lastRetro] = await Promise.all([
    db.select().from(agentRuns)
      .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.status, "running"), gte(agentRuns.startedAt, since)))
      .orderBy(desc(agentRuns.startedAt)),
    db.select({ agent: agentRuns.agent, n: count() }).from(agentRuns)
      .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.status, "done")))
      .groupBy(agentRuns.agent),
    db.select({ skill: lessons.skill, n: count() }).from(lessons)
      .where(and(eq(lessons.workspaceId, workspaceId), eq(lessons.status, "approved")))
      .groupBy(lessons.skill),
    db.select().from(activities).where(eq(activities.workspaceId, workspaceId)).orderBy(desc(activities.createdAt)).limit(40),
    computeBrief(workspaceId),
    db.select().from(retros).where(eq(retros.workspaceId, workspaceId)).orderBy(desc(retros.createdAt)).limit(1),
  ]);
  const lessonsBySkill = Object.fromEntries(lessonCounts.map((l) => [l.skill, Number(l.n)]));
  const agents = AGENTS.map((a) => {
    const mine = running.filter((r) => r.agent === a.id);
    const done = Number(doneCounts.find((d) => d.agent === a.id)?.n ?? 0);
    const learned = lessonsBySkill[a.skill] ?? 0;
    const xp = done * XP_PER_TASK + learned * XP_PER_LESSON;
    return {
      id: a.id, nameAr: a.nameAr, nameEn: a.nameEn, roomAr: a.roomAr, roomEn: a.roomEn, look: a.look,
      active: mine.length > 0, task: mine[0]?.task ?? "", tool: mine[0]?.tool ?? "",
      done, lessons: learned, xp, ...levelOf(xp),
    };
  });
  return {
    agents,
    activity: recent.map((a) => ({ at: a.createdAt.toISOString(), actor: a.actor, message: a.message })),
    brief,
    booth: { toRecord: brief.needs.filter((n) => n.kind === "record").length },
    library: { lessons: lessonCounts.reduce((s, l) => s + Number(l.n), 0), lastRetro: lastRetro[0]?.createdAt.toISOString() ?? null },
  };
}

export type OfficeState = Awaited<ReturnType<typeof officeState>>;
