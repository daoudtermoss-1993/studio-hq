import { z } from "zod";

/** Structured outputs every LLM agent must return (validated before anything is saved). */

export const TrendsOut = z.object({
  trends: z
    .array(
      z.object({
        title: z.string(),
        whyItMatters: z.string(),
        angle: z.string(),
        sources: z.array(z.string()).default([]),
        freshness: z.enum(["hot", "warm", "evergreen"]),
        confirmed: z.boolean(),
      }),
    )
    .max(8),
});

export const StrategyOut = z.object({
  newIdeas: z
    .array(z.object({ pillar: z.string(), text: z.string(), angle: z.string(), source: z.string().default(""), score: z.number().int().min(0).max(15) }))
    .max(15),
  picks: z.array(
    z.object({
      title: z.string(),
      pillar: z.string(),
      angle: z.string(),
      source: z.string().default(""),
      questions: z.array(z.string()).default([]),
      /** CEO decision memo for this reel */
      presenter: z.enum(["self", "avatar"]).default("self"),
      viralId: z.string().nullable().default(null),
      platforms: z.array(z.string()).default([]),
      goal: z.enum(["reach", "followers", "leads", "monetization", "trust"]).default("reach"),
      monetization: z.string().default(""),
      why: z.string().default(""),
    }),
  ),
});

export const ViralHuntOut = z.object({
  youtubeQueries: z.array(z.string()).max(6),
  finds: z
    .array(
      z.object({
        platform: z.enum(["youtube", "tiktok", "instagram", "facebook", "other"]),
        url: z.string(),
        title: z.string(),
        creator: z.string().default(""),
        views: z.number().nullable().default(null),
        creatorFollowers: z.number().nullable().default(null),
        publishedAt: z.string().nullable().default(null),
        description: z.string().default(""),
        whyPicked: z.string().default(""),
      }),
    )
    .max(12),
});

export const ViralAnalysisOut = z.object({
  hookType: z.string(),
  hookParaphrase: z.string(),
  structure: z.array(z.object({ start: z.number(), end: z.number(), what: z.string() })).min(2),
  format: z.string(),
  pacing: z.string(),
  emotion: z.string(),
  whyItWorks: z.array(z.string()).min(1),
  audienceSignal: z.string().default(""),
  fitScore: z.number().min(0).max(10),
  remake: z.object({ title: z.string(), angle: z.string(), ourTwist: z.string(), beatsOutline: z.array(z.string()).min(2) }),
  reactIdea: z.string().default(""),
  risks: z.array(z.string()).default([]),
});

export const StrategyPlanOut = z.object({
  summary: z.string(),
  platforms: z.array(
    z.object({
      platform: z.string(),
      role: z.string(),
      monetizationPath: z.string(),
      availableInCountry: z.enum(["yes", "no", "partial", "unknown"]),
      nextMilestone: z.string(),
      actions: z.array(z.string()),
    }),
  ),
  revenueStreams: z.array(z.object({ name: z.string(), how: z.string(), when: z.string() })),
  presenterPolicy: z.string(),
  weeklyFocus: z.string(),
  risks: z.array(z.string()).default([]),
});

export const HooksOut = z.object({
  hooks: z.array(z.object({ pattern: z.string(), spoken: z.string(), onScreen: z.string() })).min(3).max(5),
  chosenIndex: z.number().int().min(0),
  why: z.string(),
});

export const Beat = z.object({
  start: z.number(),
  end: z.number(),
  spoken: z.string(),
  onScreen: z.string().default(""),
  visual: z.string().default(""),
});

export const ScriptOut = z.object({
  beats: z.array(Beat).min(2),
  teleprompter: z.string(),
  estimatedSeconds: z.number(),
  questions: z.array(z.string()).default([]),
});

export const FactCheckOut = z.object({
  claims: z.array(z.object({ claim: z.string(), source: z.string(), ok: z.boolean(), fix: z.string().default("") })),
  revisedTeleprompter: z.string().nullable().default(null),
  revisedBeats: z.array(Beat).nullable().default(null),
  blocking: z.boolean(),
  issues: z.array(z.string()).default([]),
});

export const EditCheckOut = z.object({
  missingLines: z.array(z.string()).default([]),
  retakeNeeded: z.boolean(),
  notes: z.string(),
});

export const CaptionsOut = z.object({
  captions: z.array(z.object({ platform: z.string(), text: z.string(), hashtags: z.array(z.string()).default([]) })),
  firstComment: z.string().default(""),
});

export const CoverOut = z.object({
  coverText: z.string(),
  frameSecond: z.number().min(0),
  brief: z.string(),
});

export const RepurposeOut = z.object({
  carousel: z.array(z.string()).min(3),
  post: z.string(),
  thread: z.array(z.string()).min(2),
  shortsTitle: z.string(),
  shortsDescription: z.string(),
});

export const ChangeRouteOut = z.object({
  captions: z.string().nullable().default(null),
  cover: z.string().nullable().default(null),
  video: z
    .object({ trimStart: z.number().min(0).default(0), trimEnd: z.number().min(0).default(0), noSubtitles: z.boolean().default(false), note: z.string().default("") })
    .nullable()
    .default(null),
  retake: z.string().nullable().default(null),
});

export const AnalystOut = z.object({
  reels: z.array(
    z.object({
      number: z.number().int(),
      views: z.number().nullable().default(null),
      avgWatchPct: z.number().nullable().default(null),
      likes: z.number().nullable().default(null),
      comments: z.number().nullable().default(null),
      shares: z.number().nullable().default(null),
      saves: z.number().nullable().default(null),
      follows: z.number().nullable().default(null),
    }),
  ),
  top: z.array(z.string()).default([]),
  bottom: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export const CommunityOut = z.object({
  replies: z.array(z.object({ user: z.string(), comment: z.string(), reply: z.string() })).default([]),
  dmList: z.array(z.object({ user: z.string(), message: z.string() })).default([]),
  ideas: z.array(z.string()).default([]),
  flags: z.array(z.string()).default([]),
});

export const MeetingOut = z.object({
  lessons: z
    .array(z.object({ skill: z.enum(["general", "writing", "strategy", "trends", "editing", "analytics", "viral", "monetization"]), text: z.string(), evidence: z.string() }))
    .max(10),
  summary: z.string(),
  nextWeekFocus: z.string(),
});

export type Trends = z.infer<typeof TrendsOut>;
export type Strategy = z.infer<typeof StrategyOut>;
export type Hooks = z.infer<typeof HooksOut>;
export type Script = z.infer<typeof ScriptOut>;
export type FactCheck = z.infer<typeof FactCheckOut>;
export type EditCheck = z.infer<typeof EditCheckOut>;
export type Captions = z.infer<typeof CaptionsOut>;
export type Cover = z.infer<typeof CoverOut>;
export type Repurpose = z.infer<typeof RepurposeOut>;
export type ChangeRoute = z.infer<typeof ChangeRouteOut>;
export type Analyst = z.infer<typeof AnalystOut>;
export type Community = z.infer<typeof CommunityOut>;
export type Meeting = z.infer<typeof MeetingOut>;
export type ViralHunt = z.infer<typeof ViralHuntOut>;
export type ViralAnalysis = z.infer<typeof ViralAnalysisOut>;
export type StrategyPlan = z.infer<typeof StrategyPlanOut>;
