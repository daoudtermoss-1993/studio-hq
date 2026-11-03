import { randomUUID } from "node:crypto";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ws = () => text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" });

// ---------- accounts ----------

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  locale: text("locale").notNull().default("ar"),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token)
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const roleEnum = pgEnum("role", ["owner", "editor", "viewer"]);

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("trial"),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: ws(),
    role: roleEnum("role").notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
);

/** What every agent reads before working. */
export const brandProfiles = pgTable("brand_profiles", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  niche: text("niche").notNull(),
  audience: text("audience").notNull(),
  language: text("language").notNull().default("Lebanese Arabic"),
  tone: text("tone").notNull().default(""),
  platforms: text("platforms").array().notNull().default([]),
  reelsPerWeek: integer("reels_per_week").notNull().default(3),
  targetSeconds: integer("target_seconds").notNull().default(45),
  buffer: integer("buffer").notNull().default(2),
  pillars: text("pillars").array().notNull().default([]),
  ctaKeyword: text("cta_keyword").notNull().default(""),
  ctaReward: text("cta_reward").notNull().default(""),
  inspirations: text("inspirations").notNull().default(""),
  redLines: text("red_lines").notNull().default(""),
  recordingSetup: text("recording_setup").notNull().default(""),
  timezone: text("timezone").notNull().default("Asia/Beirut"),
  postingTime: text("posting_time").notNull().default("19:30"),
  country: text("country").notNull().default("LB"),
  goals: text("goals").notNull().default(""),
  /** self = owner records · avatar = digital twin presents · auto = the CEO decides per reel */
  presenterMode: text("presenter_mode").notNull().default("self"),
  avatarProvider: text("avatar_provider").notNull().default("heygen"),
  avatarId: text("avatar_id").notNull().default(""),
  voiceId: text("voice_id").notNull().default(""),
  /** solutions division: which markets the engineers hunt problems in */
  solutionTracks: text("solution_tracks").array().notNull().default(["smb", "technical"]),
  techFocus: text("tech_focus").notNull().default("network automation (Cisco NSO, YANG, NETCONF/RESTCONF), AI & workflow automation"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------- content ----------

export const reelStatus = pgEnum("reel_status", [
  "idea", "scripted", "ready_to_record", "rendering", "recorded", "editing", "edited", "approved", "scheduled", "posted", "rejected",
]);

export const reels = pgTable(
  "reels",
  {
    id: id(),
    workspaceId: ws(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    status: reelStatus("status").notNull().default("idea"),
    pillar: text("pillar").notNull().default(""),
    platforms: text("platforms").array().notNull().default([]),
    targetSeconds: integer("target_seconds").notNull().default(45),
    angle: text("angle").notNull().default(""),
    source: text("source").notNull().default(""),
    hooks: jsonb("hooks").$type<any>(),
    chosenHook: text("chosen_hook"),
    script: jsonb("script").$type<any>(),
    teleprompter: text("teleprompter"),
    factCheck: jsonb("fact_check").$type<any>(),
    captions: jsonb("captions").$type<any>(),
    cover: jsonb("cover").$type<any>(),
    repurpose: jsonb("repurpose").$type<any>(),
    editReport: jsonb("edit_report").$type<any>(),
    results: jsonb("results").$type<any>(),
    questions: jsonb("questions").$type<{ id: string; text: string; answer?: string }[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    /** who appears in the video: the owner or the digital twin */
    presenter: text("presenter").notNull().default("self"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    viralId: text("viral_id"),
    /** the CEO's written decision: why this reel, platforms, goal, monetization angle */
    decision: jsonb("decision").$type<any>(),
    avatarJob: jsonb("avatar_job").$type<any>(),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    rawAssetId: text("raw_asset_id"),
    finalAssetId: text("final_asset_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("reels_ws_number_uq").on(t.workspaceId, t.number), index("reels_ws_status_idx").on(t.workspaceId, t.status)],
);

export const assets = pgTable("assets", {
  id: id(),
  workspaceId: ws(),
  reelId: text("reel_id").references(() => reels.id, { onDelete: "set null" }),
  kind: text("kind").notNull(), // raw | final | srt | cover
  key: text("key").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull().default(0),
  createdAt: createdAt(),
});

export const ideas = pgTable("ideas", {
  id: id(),
  workspaceId: ws(),
  pillar: text("pillar").notNull().default(""),
  text: text("text").notNull(),
  angle: text("angle").notNull().default(""),
  source: text("source").notNull().default(""),
  score: integer("score").notNull().default(0),
  used: boolean("used").notNull().default(false),
  createdAt: createdAt(),
});

export const trendReports = pgTable(
  "trend_reports",
  { id: id(), workspaceId: ws(), date: text("date").notNull(), items: jsonb("items").$type<any[]>().notNull(), createdAt: createdAt() },
  (t) => [uniqueIndex("trends_ws_date_uq").on(t.workspaceId, t.date)],
);

// ---------- viral lab & strategy ----------

export const viralStatus = pgEnum("viral_status", ["new", "analyzed", "adopted", "dismissed"]);

export const viralFinds = pgTable(
  "viral_finds",
  {
    id: id(),
    workspaceId: ws(),
    platform: text("platform").notNull(), // youtube | tiktok | instagram | facebook | other
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    creator: text("creator").notNull().default(""),
    views: integer("views"),
    likes: integer("likes"),
    comments: integer("comments"),
    creatorFollowers: integer("creator_followers"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** views per hour since publishing */
    velocity: integer("velocity"),
    /** views ÷ creator followers: > 3 means it beat the creator's normal reach */
    outlier: integer("outlier"),
    source: text("source").notNull().default("web"), // youtube-api | web | manual
    description: text("description").notNull().default(""),
    analysis: jsonb("analysis").$type<any>(),
    status: viralStatus("status").notNull().default("new"),
    reelId: text("reel_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("viral_ws_url_uq").on(t.workspaceId, t.url), index("viral_ws_status_idx").on(t.workspaceId, t.status)],
);

export const strategyReports = pgTable("strategy_reports", {
  id: id(),
  workspaceId: ws(),
  plan: jsonb("plan").$type<any>().notNull(),
  createdAt: createdAt(),
});

// ---------- solutions division (problems → solutions → deals) ----------

export const problemStatus = pgEnum("problem_status", [
  "new", "qualified", "rejected", "solving", "solved", "contacted", "replied", "won", "lost",
]);

export const problems = pgTable(
  "problems",
  {
    id: id(),
    workspaceId: ws(),
    track: text("track").notNull().default("smb"), // smb | technical
    source: text("source").notNull().default("web"), // reddit | stackexchange | hn | github | web | manual | comments
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    author: text("author").notNull().default(""),
    organization: text("organization").notNull().default(""),
    contact: text("contact").notNull().default(""),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    votes: integer("votes"),
    status: problemStatus("status").notNull().default("new"),
    qualification: jsonb("qualification").$type<any>(),
    solution: jsonb("solution").$type<any>(),
    demo: jsonb("demo").$type<any>(),
    review: jsonb("review").$type<any>(),
    outreach: jsonb("outreach").$type<any>(),
    dealValue: integer("deal_value"),
    notes: text("notes").notNull().default(""),
    reelId: text("reel_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("problems_ws_url_uq").on(t.workspaceId, t.url), index("problems_ws_status_idx").on(t.workspaceId, t.status)],
);

/** Remote MCP servers the engineers may use (token encrypted at rest). */
export const connectors = pgTable("connectors", {
  id: id(),
  workspaceId: ws(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  tokenEnc: text("token_enc"),
  agents: text("agents").array().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

// ---------- the team ----------

export const runStatus = pgEnum("run_status", ["running", "done", "failed"]);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    workspaceId: ws(),
    reelId: text("reel_id"),
    agent: text("agent").notNull(),
    task: text("task").notNull(),
    status: runStatus("status").notNull().default("running"),
    tool: text("tool").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("runs_ws_started_idx").on(t.workspaceId, t.startedAt), index("runs_ws_agent_idx").on(t.workspaceId, t.agent, t.status)],
);

export const lessonStatus = pgEnum("lesson_status", ["proposed", "approved", "rejected"]);

export const lessons = pgTable("lessons", {
  id: id(),
  workspaceId: ws(),
  skill: text("skill").notNull(),
  text: text("text").notNull(),
  evidence: text("evidence").notNull().default(""),
  status: lessonStatus("status").notNull().default("proposed"),
  createdAt: createdAt(),
});

export const activities = pgTable(
  "activities",
  { id: id(), workspaceId: ws(), actor: text("actor").notNull(), message: text("message").notNull(), createdAt: createdAt() },
  (t) => [index("activities_ws_created_idx").on(t.workspaceId, t.createdAt)],
);

export const retros = pgTable("retros", { id: id(), workspaceId: ws(), summary: text("summary").notNull(), createdAt: createdAt() });

export const dataImports = pgTable("data_imports", {
  id: id(),
  workspaceId: ws(),
  kind: text("kind").notNull(), // metrics | comments
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  processed: boolean("processed").notNull().default(false),
  result: jsonb("result").$type<any>(),
  createdAt: createdAt(),
});

// ---------- background jobs (Postgres queue, SKIP LOCKED) ----------

export const jobStatus = pgEnum("job_status", ["queued", "running", "done", "failed"]);

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, any>>().notNull().default({}),
    dedupeKey: text("dedupe_key"),
    status: jobStatus("status").notNull().default("queued"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("jobs_status_run_idx").on(t.status, t.runAt), index("jobs_dedupe_idx").on(t.type, t.dedupeKey)],
);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type BrandProfile = typeof brandProfiles.$inferSelect;
export type Reel = typeof reels.$inferSelect;
export type ReelStatus = (typeof reelStatus.enumValues)[number];
export type Asset = typeof assets.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type ViralFind = typeof viralFinds.$inferSelect;
export type Problem = typeof problems.$inferSelect;
export type Connector = typeof connectors.$inferSelect;
