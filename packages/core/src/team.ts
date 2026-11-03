import { activities, agentRuns, and, asc, db, eq, inArray, lessons, type BrandProfile } from "@studio/db";
import type { z } from "zod";
import { AGENT_BY_ID, type AgentId } from "./agents";
import { callAgent } from "./ai";
import { SKILLS, type SkillId } from "./skills";

export async function log(workspaceId: string, actor: string, message: string) {
  await db.insert(activities).values({ workspaceId, actor, message: message.slice(0, 500) });
}

export interface RunHandle {
  runId: string;
  setTool(tool: string): Promise<void>;
  addUsage(u: { input: number; output: number }): void;
}

/** Wraps a unit of work as a visible agent run: the lamp turns on in the office, XP on success. */
export async function runAgent<T>(
  workspaceId: string,
  agent: AgentId,
  task: string,
  reelId: string | null,
  fn: (h: RunHandle) => Promise<T>,
): Promise<T> {
  const [run] = await db.insert(agentRuns).values({ workspaceId, agent, task, reelId }).returning();
  await log(workspaceId, agent, `بلّش: ${task}`);
  const usage = { input: 0, output: 0 };
  const h: RunHandle = {
    runId: run.id,
    setTool: async (tool) => {
      await db.update(agentRuns).set({ tool: tool.slice(0, 200) }).where(eq(agentRuns.id, run.id));
    },
    addUsage: (u) => {
      usage.input += u.input;
      usage.output += u.output;
    },
  };
  try {
    const result = await fn(h);
    await db
      .update(agentRuns)
      .set({ status: "done", finishedAt: new Date(), inputTokens: usage.input, outputTokens: usage.output, tool: "" })
      .where(eq(agentRuns.id, run.id));
    await log(workspaceId, agent, `خلّص: ${task}`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(agentRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 2000), inputTokens: usage.input, outputTokens: usage.output })
      .where(eq(agentRuns.id, run.id));
    await log(workspaceId, agent, `واجه مشكلة: ${task}`);
    throw err;
  }
}

export function brandContext(b: BrandProfile) {
  return `BRAND PROFILE (read before working)
- Niche: ${b.niche}
- Audience: ${b.audience}
- Language & dialect: ${b.language}
- Tone: ${b.tone || "direct, warm, no hype"}
- Platforms: ${b.platforms.join(", ")}
- Rhythm: ${b.reelsPerWeek} reels/week, target length ${b.targetSeconds}s
- Content pillars: ${b.pillars.join(" | ")}
- Comment-keyword CTA: ${b.ctaKeyword ? `comment "${b.ctaKeyword}" to get ${b.ctaReward}` : "none"}
- Inspiration accounts: ${b.inspirations || "-"}
- Red lines: ${b.redLines || "-"}
- Recording setup: ${b.recordingSetup || "-"}`;
}

async function approvedLessons(workspaceId: string, skill: SkillId) {
  const rows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.workspaceId, workspaceId), eq(lessons.status, "approved"), inArray(lessons.skill, [skill, "general"])))
    .orderBy(asc(lessons.createdAt))
    .limit(60);
  return rows.map((l) => `- ${l.text}`).join("\n");
}

/** Builds the agent's system prompt (role + brand + house rules + learned lessons) and calls it. */
export async function ask<S extends z.ZodTypeAny>(
  h: RunHandle,
  workspaceId: string,
  brand: BrandProfile,
  agent: AgentId,
  prompt: string,
  schema: S,
  opts: { tier?: "smart" | "fast"; webSearch?: boolean; mockAs?: string } = {},
): Promise<z.infer<S>> {
  const def = AGENT_BY_ID[agent];
  const lessons = await approvedLessons(workspaceId, def.skill);
  const system = `${def.role}

${brandContext(brand)}

HOUSE RULES
${SKILLS.general.rules}
${def.skill !== "general" ? `\n${SKILLS[def.skill].nameEn.toUpperCase()} RULES\n${SKILLS[def.skill].rules}` : ""}
${lessons ? `\nLESSONS THE TEAM LEARNED (follow them, they override defaults)\n${lessons}` : ""}

Write all human-facing text in the brand's language and dialect. Return your result only through the submit tool.`;
  await h.setTool(opts.webSearch ? "WebSearch" : "Claude");
  const res = await callAgent({ agent: opts.mockAs ?? agent, system, prompt, schema, tier: opts.tier, webSearch: opts.webSearch });
  h.addUsage(res.usage);
  return res.data;
}
