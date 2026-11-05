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
    .array(z.object({
      skill: z.enum(["general", "writing", "strategy", "trends", "editing", "analytics", "viral", "monetization", "engineering", "automation", "ai-engineering", "network", "software", "security", "outreach"]),
      text: z.string(), evidence: z.string(),
    }))
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

export const SPECIALISTS = ["automation-engineer", "ai-engineer", "network-engineer", "software-engineer"] as const;

export const ProblemHuntOut = z.object({
  queries: z
    .array(z.object({ source: z.enum(["reddit", "stackexchange", "hn", "github"]), q: z.string(), where: z.string().default(""), track: z.enum(["smb", "technical"]).optional() }))
    .max(10),
  finds: z
    .array(
      z.object({
        track: z.enum(["smb", "technical"]),
        url: z.string(),
        title: z.string(),
        body: z.string().default(""),
        author: z.string().default(""),
        organization: z.string().default(""),
        contact: z.string().default(""),
        postedAt: z.string().nullable().default(null),
      }),
    )
    .max(12),
});

export const QualifyOut = z.object({
  canSolve: z.boolean(),
  fitScore: z.number().min(0).max(10),
  valueEstimate: z.string(),
  reachable: z.boolean(),
  assignee: z.enum(SPECIALISTS),
  effortDays: z.object({ best: z.number(), likely: z.number(), worst: z.number() }),
  price: z.object({ setup: z.string(), monthly: z.string().default(""), currency: z.string().default("USD") }),
  why: z.string(),
  rejectReason: z.string().default(""),
  questions: z.array(z.string()).default([]),
});

export const SolutionOut = z.object({
  summary: z.string(),
  rootCause: z.string(),
  approach: z.string(),
  architecture: z.array(z.string()).min(1),
  steps: z.array(z.string()).min(2),
  stack: z.array(z.string()).default([]),
  runningCost: z.string().default(""),
  risks: z.array(z.string()).default([]),
  demoPlan: z.string(),
  sources: z.array(z.string()).default([]),
});

export const DemoOut = z.object({
  files: z.array(z.object({ path: z.string(), content: z.string() })).min(1).max(8),
  howToRun: z.string(),
  testCommand: z.string(),
  testOutput: z.string(),
  works: z.boolean(),
  limitations: z.array(z.string()).default([]),
});

export const ReviewOut = z.object({
  verdict: z.enum(["approve", "fix-first", "reject"]),
  issues: z.array(z.object({ severity: z.enum(["critical", "high", "medium", "low"]), issue: z.string(), fix: z.string() })).default([]),
  summary: z.string(),
});

export const OutreachOut = z.object({
  channel: z.string(),
  message: z.string(),
  followUp: z.string(),
  publicReply: z.string().default(""),
  personalization: z.string().default(""),
});

export type Qualify = z.infer<typeof QualifyOut>;
export type Solution = z.infer<typeof SolutionOut>;
export type Demo = z.infer<typeof DemoOut>;

// ---------- opportunities division (websites & local presence) ----------

export const ScoutOut = z.object({
  businesses: z
    .array(z.object({
      name: z.string(), website: z.string().default(""), phone: z.string().default(""), address: z.string().default(""),
      sourceUrl: z.string().default(""), why: z.string().default(""),
    }))
    .max(15),
});

export const AuditReportOut = z.object({
  headline: z.string(),
  summary: z.string(),
  topIssues: z.array(z.object({ findingId: z.string(), plain: z.string(), impact: z.string() })).max(5),
  quickWins: z.array(z.string()).max(6).default([]),
  recommendedPackage: z.string(),
  worthIt: z.boolean(),
  why: z.string(),
  siteLanguage: z.string().default("ar"),
});

export const DesignOut = z.object({
  concept: z.string(),
  audience: z.string(),
  palette: z.array(z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), use: z.string() })).min(3).max(6),
  typography: z.object({ heading: z.string(), body: z.string(), scale: z.string().default("") }),
  sitemap: z.array(z.string()).min(3),
  html: z.string().min(2000),
  backend: z.object({
    architecture: z.array(z.string()).min(3),
    stack: z.array(z.string()).min(2),
    dataModel: z.array(z.string()).default([]),
    integrations: z.array(z.string()).default([]),
    hosting: z.string(),
    performanceBudget: z.array(z.string()).default([]),
    seo: z.array(z.string()).default([]),
    security: z.array(z.string()).default([]),
    monthlyCost: z.string(),
  }),
  buildPlan: z.array(z.object({ phase: z.string(), days: z.number(), deliverable: z.string() })).min(2),
  placeholders: z.array(z.string()).default([]),
});

export type AuditReport = z.infer<typeof AuditReportOut>;
export type Design = z.infer<typeof DesignOut>;

// ---------- client delivery ----------

export const KnowledgeOut = z.object({
  businessName: z.string(),
  summary: z.string(),
  languages: z.array(z.string()).default(["ar"]),
  services: z.array(z.object({ name: z.string(), description: z.string().default(""), price: z.string().default(""), duration: z.string().default("") })).default([]),
  hours: z.array(z.object({ days: z.string(), open: z.string(), close: z.string() })).default([]),
  location: z.object({ address: z.string().default(""), area: z.string().default(""), directions: z.string().default(""), mapsUrl: z.string().default("") }).default({}),
  contact: z.object({ phone: z.string().default(""), whatsapp: z.string().default(""), email: z.string().default(""), emergency: z.string().default("") }).default({}),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  policies: z.array(z.string()).default([]),
  bookingInfo: z.string().default(""),
  doNotAnswer: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
});
export type Knowledge = z.infer<typeof KnowledgeOut>;

export const ReceptionistOut = z.object({
  reply: z.string().min(1),
  intent: z.enum(["info", "price", "booking", "handoff", "smalltalk", "out-of-scope"]),
  language: z.string().default("ar"),
  confidence: z.number().min(0).max(1),
  usedFacts: z.array(z.string()).default([]),
  booking: z.object({ name: z.string().default(""), service: z.string().default(""), preferredTime: z.string().default(""), complete: z.boolean() }).nullable().default(null),
  handoffReason: z.string().default(""),
});
export type ReceptionistReply = z.infer<typeof ReceptionistOut>;

export const EvalSetOut = z.object({
  cases: z
    .array(z.object({
      id: z.string(),
      category: z.enum(["info", "price", "booking", "out-of-scope", "medical", "complaint", "injection", "arabizi", "french", "english"]),
      message: z.string(),
      expect: z.enum(["answer", "handoff", "booking", "refuse"]),
      mustInclude: z.array(z.string()).default([]),
      mustNotInclude: z.array(z.string()).default([]),
    }))
    .min(10).max(40),
});

export const JudgeOut = z.object({
  grades: z.array(z.object({ id: z.string(), pass: z.boolean(), reason: z.string() })),
  summary: z.string(),
  fixes: z.array(z.string()).default([]),
});

export const TemplatesOut = z.object({
  templates: z.array(z.object({ name: z.string().regex(/^[a-z0-9_]+$/), category: z.enum(["UTILITY", "MARKETING"]), language: z.string(), body: z.string(), example: z.string().default("") })).min(1).max(6),
});

export const ReviewReplyOut = z.object({ replies: z.array(z.object({ id: z.string(), reply: z.string(), flag: z.string().default("") })) });

export const CampaignOut = z.object({
  name: z.string(),
  segment: z.string(),
  why: z.string(),
  template: z.object({ name: z.string().regex(/^[a-z0-9_]+$/), language: z.string(), body: z.string() }),
  expected: z.string(),
});

export const ClientReportOut = z.object({ headline: z.string(), summary: z.string(), wins: z.array(z.string()).default([]), issues: z.array(z.string()).default([]), next: z.array(z.string()).default([]) });

/** What the business already uses online, so offers complement it instead of selling it twice. */
export const PresenceOut = z.object({
  profiles: z
    .array(z.object({
      platform: z.string(), url: z.string().default(""),
      kind: z.enum(["booking", "telehealth", "directory", "social", "messaging", "maps", "website"]),
      does: z.string(), active: z.enum(["yes", "no", "unknown"]).default("unknown"),
    }))
    .max(12),
  primaryChannel: z.string(),
  alreadyCovered: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  positioning: z.string(),
});
export type Presence = z.infer<typeof PresenceOut>;

// ---------- consulting division ----------

export const AccountResearchOut = z.object({
  summary: z.string(),
  whatTheyDo: z.string(),
  size: z.string().default(""),
  systems: z.array(z.string()).default([]),
  signals: z.array(z.object({ signal: z.string(), source: z.string() })).max(10).default([]),
  likelyPains: z.array(z.object({ pain: z.string(), why: z.string() })).max(8).default([]),
  firstCallQuestions: z.array(z.string()).min(3).max(10),
  redFlags: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
});

export const InterviewOut = z.object({
  summary: z.string(),
  tasks: z
    .array(z.object({
      task: z.string(),
      who: z.string().default(""),
      timesPerMonth: z.number().nonnegative().nullable(),
      minutesEach: z.number().nonnegative().nullable(),
      saidBy: z.string().default(""),
      quote: z.string().default(""),
    }))
    .max(12),
  hourlyCost: z.number().nonnegative().nullable().default(null),
  systems: z.array(z.string()).default([]),
  data: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export const OppInputs = z.object({
  tasksPerMonth: z.number().nonnegative(),
  minutesSaved: z.number().nonnegative(),
  hourlyCost: z.number().nonnegative(),
  runningMonthly: z.number().nonnegative().default(0),
  setupCost: z.number().nonnegative().default(0),
});

export const OpportunityMapOut = z.object({
  summary: z.string(),
  items: z
    .array(z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string(),
      problem: z.string(),
      solution: z.string(),
      value: z.number().min(1).max(5),
      ease: z.number().min(1).max(5),
      speed: z.number().min(1).max(5),
      inputs: OppInputs,
      /** where each input came from: "interview: <who>" or "assumption" */
      inputSources: z.object({ tasksPerMonth: z.string(), minutesSaved: z.string(), hourlyCost: z.string() }),
      dataNeeded: z.array(z.string()).default([]),
      risks: z.array(z.string()).default([]),
      redFlags: z.array(z.string()).default([]),
    }))
    .min(1)
    .max(10),
});

export const ProposalOut = z.object({
  title: z.string(),
  problemInTheirWords: z.string(),
  approach: z.string(),
  deliverables: z.array(z.string()).min(1),
  timeline: z.array(z.object({ when: z.string(), what: z.string() })).min(1),
  weNeed: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  successMeasure: z.string(),
  coverEmail: z.object({ subject: z.string(), body: z.string() }),
});

export const PilotPlanOut = z.object({
  weeks: z.array(z.object({ week: z.string(), goal: z.string(), tasks: z.array(z.string()) })).min(2).max(8),
  metrics: z
    .array(z.object({
      key: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string(),
      unit: z.string(),
      /** minutes-per-task and tasks-per-month feed the realized-saving formula */
      kind: z.enum(["minutes-per-task", "tasks-per-month", "other"]),
      higherIsBetter: z.boolean(),
      howToMeasure: z.string(),
    }))
    .min(1)
    .max(6),
  dataAccess: z.array(z.string()).default([]),
  humanInLoop: z.string(),
  rollback: z.string(),
  risks: z.array(z.string()).default([]),
});

export const PilotReportOut = z.object({
  headline: z.string(),
  wins: z.array(z.string()).default([]),
  issues: z.array(z.string()).default([]),
  next: z.string(),
  clientMessage: z.string(),
});

export type AccountResearch = z.infer<typeof AccountResearchOut>;
export type InterviewSynthesis = z.infer<typeof InterviewOut>;
export type OpportunityMap = z.infer<typeof OpportunityMapOut>;
export type Proposal = z.infer<typeof ProposalOut>;
export type PilotPlan = z.infer<typeof PilotPlanOut>;
