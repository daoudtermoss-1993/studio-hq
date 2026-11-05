import { randomUUID } from "node:crypto";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** Starting prices (USD, Lebanon market) — owner edits them in settings. */
export const DEFAULT_CATALOG = [
  "speed-fix | إصلاح السرعة والموبايل | $250 | ضغط الصور، كاش و CDN، إصلاح الموبايل، تقرير قبل/بعد بالأرقام",
  "new-site | موقع جديد سريع | $700 + $25/شهر | تصميم كامل، حجز عالواتساب، SEO محلي، استضافة وصيانة",
  "google-profile | ملف Google والتقييمات | $150 + $40/شهر | تصليح الملف، صور، ردود على التقييمات كل أسبوع",
  "whatsapp-booking | حجز وتذكير عالواتساب | $400 + $30/شهر | رد أوتوماتيكي، حجز مواعيد، تذكير قبل الموعد",
].join("\n");

/** Consulting ladder (USD) — owner edits them in settings; each engagement can override. */
export const DEFAULT_CONSULTING_CATALOG = [
  "assessment | تقييم فرص الـ AI (أسبوعين) | $2,000 | مقابلات ومراقبة، تحليل الداتا، 3 لـ 5 فرص بالأرقام، demo، توصية بتجربة",
  "pilot | تجربة تنفيذ (4 لـ 6 أسابيع) | $8,000 | حل واحد شغّال بمحيط الزبون، وضع المسودة، قياس قبل وبعد، تسليم وتدريب",
  "retainer | اشتراك شهري | $1,000/شهر | صيانة وتحسين، تقرير شهري بالأرقام، فرصة جديدة كل 3 أشهر",
].join("\n");

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
  /** opportunities division: fixed-price services, one per line: id | name | price | what's included */
  serviceCatalog: text("service_catalog").notNull().default(DEFAULT_CATALOG),
  oppVertical: text("opp_vertical").notNull().default("عيادات أسنان"),
  oppCity: text("opp_city").notNull().default("بيروت"),
  /** consulting division: assessment / pilot / retainer, one per line: id | name | price | what's included */
  consultingCatalog: text("consulting_catalog").notNull().default(DEFAULT_CONSULTING_CATALOG),
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
    /** problem = someone asked for help · opportunity = we found a business we can improve (website/Google presence) */
    kind: text("kind").notNull().default("problem"),
    placeId: text("place_id"),
    website: text("website").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    rating: real("rating"),
    reviews: integer("reviews"),
    /** Google Places content other than place_id is cleared after this date (unless the owner contacted them) */
    googleExpiresAt: timestamp("google_expires_at", { withTimezone: true }),
    audit: jsonb("audit").$type<any>(),
    design: jsonb("design").$type<any>(),
    offer: jsonb("offer").$type<any>(),
    previewToken: text("preview_token"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("problems_preview_uq").on(t.previewToken), index("problems_ws_place_idx").on(t.workspaceId, t.placeId), uniqueIndex("problems_ws_url_uq").on(t.workspaceId, t.url), index("problems_ws_status_idx").on(t.workspaceId, t.status)],
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

// ---------- client delivery (AI employees that work FOR the owner's clients) ----------

export const clientStatus = pgEnum("client_status", ["onboarding", "active", "paused"]);

/** A business that bought a service. Its AI employees (receptionist, reminders, reviews…) run on its own knowledge base. */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    workspaceId: ws(),
    name: text("name").notNull(),
    vertical: text("vertical").notNull().default(""),
    city: text("city").notNull().default(""),
    website: text("website").notNull().default(""),
    phone: text("phone").notNull().default(""),
    timezone: text("timezone").notNull().default("Asia/Beirut"),
    status: clientStatus("status").notNull().default("onboarding"),
    problemId: text("problem_id"),
    /** owner's notes / facts for the knowledge engineer (prices, doctors, policies…) */
    notes: text("notes").notNull().default(""),
    knowledge: jsonb("knowledge").$type<any>(),
    knowledgeAt: timestamp("knowledge_at", { withTimezone: true }),
    /** tone, escalation contact, booking mode, review link, reminder template, retention, caps, autoReply */
    settings: jsonb("settings").$type<Record<string, any>>().notNull().default({}),
    demoToken: text("demo_token").notNull(),
    waPhoneNumberId: text("wa_phone_number_id").notNull().default(""),
    waTokenEnc: text("wa_token_enc"),
    waAppSecretEnc: text("wa_app_secret_enc"),
    waVerifyToken: text("wa_verify_token").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("clients_demo_uq").on(t.demoToken), index("clients_ws_idx").on(t.workspaceId), index("clients_wa_phone_idx").on(t.waPhoneNumberId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    workspaceId: ws(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // test | demo | whatsapp
    contact: text("contact").notNull(), // wa_id or a random demo session id
    contactName: text("contact_name").notNull().default(""),
    handoff: boolean("handoff").notNull().default(false),
    handoffReason: text("handoff_reason").notNull().default(""),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("conversations_uq").on(t.clientId, t.channel, t.contact), index("conversations_last_idx").on(t.clientId, t.lastMessageAt)],
);

export const messageStatus = pgEnum("message_status", ["received", "pending", "draft", "sent", "failed", "skipped"]);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    workspaceId: ws(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant | staff
    text: text("text").notNull(),
    status: messageStatus("status").notNull().default("received"),
    intent: text("intent").notNull().default(""),
    confidence: real("confidence"),
    meta: jsonb("meta").$type<Record<string, any>>().notNull().default({}),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("messages_external_uq").on(t.clientId, t.externalId), index("messages_conv_idx").on(t.conversationId, t.createdAt)],
);

export const bookingStatus = pgEnum("booking_status", ["requested", "confirmed", "declined", "done", "no_show", "cancelled"]);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    workspaceId: ws(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id"),
    name: text("name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    service: text("service").notNull().default(""),
    preferredTime: text("preferred_time").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    status: bookingStatus("status").notNull().default("requested"),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("bookings_client_idx").on(t.clientId, t.status)],
);

/** People who agreed to hear from the client (needed before any proactive message). */
export const clientContacts = pgTable(
  "client_contacts",
  {
    id: id(),
    workspaceId: ws(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    phone: text("phone").notNull(),
    optIn: boolean("opt_in").notNull().default(false),
    lastVisit: timestamp("last_visit", { withTimezone: true }),
    tags: text("tags").array().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("client_contacts_uq").on(t.clientId, t.phone)],
);

export const clientReviews = pgTable("client_reviews", {
  id: id(),
  workspaceId: ws(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  author: text("author").notNull().default(""),
  rating: integer("rating"),
  text: text("text").notNull(),
  reply: text("reply").notNull().default(""),
  status: text("status").notNull().default("new"), // new | drafted | approved
  createdAt: createdAt(),
});

/** Agent outputs tied to a client: evaluations (X/30), campaigns, monthly reports. */
export const clientArtifacts = pgTable(
  "client_artifacts",
  {
    id: id(),
    workspaceId: ws(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // evaluation | campaign | report | templates
    period: text("period").notNull().default(""),
    data: jsonb("data").$type<any>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("client_artifacts_idx").on(t.clientId, t.kind, t.createdAt)],
);

// ---------- consulting division (the owner is the consultant; the team prepares, analyses, builds and reviews) ----------

export const engagementStage = pgEnum("engagement_stage", ["lead", "proposal", "assessment", "pilot", "retainer", "closed", "lost"]);

/** One company the owner advises: research → interviews → scored opportunities → proposal → pilot with before/after numbers. */
export const engagements = pgTable(
  "engagements",
  {
    id: id(),
    workspaceId: ws(),
    company: text("company").notNull(),
    website: text("website").notNull().default(""),
    sector: text("sector").notNull().default(""),
    country: text("country").notNull().default(""),
    size: text("size").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    contactRole: text("contact_role").notNull().default(""),
    /** network | linkedin | referral | freelance | event | other */
    source: text("source").notNull().default("network"),
    /** lebanon | gulf | remote — sets the price guidance */
    market: text("market").notNull().default("lebanon"),
    /** language the client reads (proposals, emails, reports) */
    language: text("language").notNull().default("Lebanese Arabic"),
    stage: engagementStage("stage").notNull().default("lead"),
    /** owner's first-call notes (contact details are masked before saving) */
    notes: text("notes").notNull().default(""),
    research: jsonb("research").$type<any>(),
    opportunities: jsonb("opportunities").$type<any>(),
    proposal: jsonb("proposal").$type<any>(),
    pilotProposal: jsonb("pilot_proposal").$type<any>(),
    pilot: jsonb("pilot").$type<any>(),
    pilotReport: jsonb("pilot_report").$type<any>(),
    demo: jsonb("demo").$type<any>(),
    review: jsonb("review").$type<any>(),
    /** per-engagement price overrides: { assessment, pilot, retainer } */
    prices: jsonb("prices").$type<Record<string, string>>().notNull().default({}),
    value: integer("value"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("engagements_ws_stage_idx").on(t.workspaceId, t.stage)],
);

export const engagementInterviews = pgTable(
  "engagement_interviews",
  {
    id: id(),
    workspaceId: ws(),
    engagementId: text("engagement_id").notNull().references(() => engagements.id, { onDelete: "cascade" }),
    /** management | team | it | finance | other */
    role: text("role").notNull(),
    person: text("person").notNull().default(""),
    notes: text("notes").notNull(),
    synthesis: jsonb("synthesis").$type<any>(),
    createdAt: createdAt(),
  },
  (t) => [index("engagement_interviews_idx").on(t.engagementId, t.createdAt)],
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
export type Client = typeof clients.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ClientContact = typeof clientContacts.$inferSelect;
export type ClientReview = typeof clientReviews.$inferSelect;
export type ClientArtifact = typeof clientArtifacts.$inferSelect;
export type Engagement = typeof engagements.$inferSelect;
export type EngagementInterview = typeof engagementInterviews.$inferSelect;
export type EngagementStage = (typeof engagementStage.enumValues)[number];
