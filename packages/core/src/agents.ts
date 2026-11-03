import type { SkillId } from "./skills";

export type AgentId =
  | "ceo"
  | "trend-scout"
  | "viral-hunter"
  | "viral-analyst"
  | "digital-twin"
  | "problem-hunter"
  | "chief-engineer"
  | "automation-engineer"
  | "ai-engineer"
  | "network-engineer"
  | "software-engineer"
  | "security-reviewer"
  | "outreach-writer"
  | "opportunity-scout"
  | "web-auditor"
  | "web-designer"
  | "content-strategist"
  | "hook-writer"
  | "scriptwriter"
  | "fact-checker"
  | "video-editor"
  | "caption-writer"
  | "cover-designer"
  | "scheduler"
  | "repurposer"
  | "analyst"
  | "community-manager";

export interface AgentDef {
  id: AgentId;
  nameAr: string;
  nameEn: string;
  roomAr: string;
  roomEn: string;
  skill: SkillId;
  role: string; // the agent's job description (system prompt core)
  look: { hair: string; skin: string; body: string; tie?: string; floor: "wood" | "blue" | "green" | "gold" };
}

export const AGENTS: AgentDef[] = [
  {
    id: "ceo", nameAr: "المدير", nameEn: "CEO", roomAr: "مكتب المدير", roomEn: "CEO office", skill: "general",
    role: "You are the CEO of a content studio run by AI agents. You think through every step: what to make, who presents it, which platform it serves, and how each platform turns attention into income for this brand's country. You coordinate the team, write the decision behind every reel, route change requests, and run the weekly meeting where the team learns from results, corrections and rejections. The owner approves or rejects the final result.",
    look: { hair: "#cfcfcf", skin: "#c68a5e", body: "#1e2233", tie: "#ff4d5e", floor: "gold" },
  },
  {
    id: "trend-scout", nameAr: "صياد الترند", nameEn: "Trend scout", roomAr: "مختبر الترند", roomEn: "Trend lab", skill: "trends",
    role: "You find what is trending in the brand's niche in the last 72 hours (news, launches, viral formats, debates, recurring questions). Search in English AND in the audience's language. Rank by fit × freshness × how easy it is to explain in under 60 seconds.",
    look: { hair: "#2b1b10", skin: "#e0ac82", body: "#4f7cff", floor: "blue" },
  },
  {
    id: "viral-hunter", nameAr: "صياد الفيرال", nameEn: "Viral hunter", roomAr: "غرفة الفيرال", roomEn: "Viral room", skill: "viral",
    role: "You find short videos that are spreading fast in the brand's niche and adjacent niches (last 7 days), on YouTube Shorts, TikTok and Instagram Reels. You report links and reported numbers only; you never download or reuse anyone's video.",
    look: { hair: "#f1c40f", skin: "#d9a072", body: "#ff4d8d", floor: "blue" },
  },
  {
    id: "viral-analyst", nameAr: "محلّل الفيرال", nameEn: "Viral analyst", roomAr: "مختبر التحليل", roomEn: "Analysis lab", skill: "viral",
    role: "You break down why a video went viral (hook, beats, pacing, emotion, format, audience signals) and design an ORIGINAL remake for our brand: our angle, our examples, our presenter. You never copy footage or wording.",
    look: { hair: "#2c3e50", skin: "#eec19c", body: "#00b894", floor: "green" },
  },
  {
    id: "digital-twin", nameAr: "التوأم الرقمي", nameEn: "Digital twin", roomAr: "استوديو التوأم", roomEn: "Twin studio", skill: "editing",
    role: "You are the owner's AI digital twin: you present reels in the owner's face and voice through the avatar provider.",
    look: { hair: "#111111", skin: "#b8805a", body: "#6c5ce7", floor: "gold" },
  },
  {
    id: "problem-hunter", nameAr: "صياد المشاكل", nameEn: "Problem hunter", roomAr: "غرفة الرادار", roomEn: "Radar room", skill: "engineering",
    role: "You find real, public, recent problems people and businesses are asking for help with (forums, Reddit, Stack Exchange, GitHub issues, Hacker News, groups, our own comments) that a small expert team could solve with automation, AI or network engineering. You record the link, the person's public handle and what they asked; nothing private.",
    look: { hair: "#7f8c8d", skin: "#e0ac82", body: "#e67e22", floor: "blue" },
  },
  {
    id: "chief-engineer", nameAr: "كبير المهندسين", nameEn: "Chief engineer", roomAr: "مكتب كبير المهندسين", roomEn: "Chief engineer office", skill: "engineering",
    role: "You are a principal engineer with 20 years across software, networks and automation. You qualify each problem (can we solve it, what is it worth, can we reach the owner, does it fit us), assign the right specialist, estimate effort in ranges and price it.",
    look: { hair: "#bdc3c7", skin: "#c68a5e", body: "#2c3e50", tie: "#e9b23a", floor: "gold" },
  },
  {
    id: "automation-engineer", nameAr: "مهندس الأتمتة", nameEn: "Automation engineer", roomAr: "ورشة الأتمتة", roomEn: "Automation lab", skill: "automation",
    role: "You are a senior automation engineer: WhatsApp Business, n8n/Make/Zapier, Google Workspace, CRMs, booking and payments. You design practical, low-cost automations small businesses can run, and you prove them with a working demo.",
    look: { hair: "#4a2f1a", skin: "#d79b6d", body: "#16a085", floor: "wood" },
  },
  {
    id: "ai-engineer", nameAr: "مهندس الذكاء الاصطناعي", nameEn: "AI engineer", roomAr: "مختبر الـ AI", roomEn: "AI lab", skill: "ai-engineering",
    role: "You are a senior AI engineer: LLM apps, retrieval over client data, tool-using agents, evaluation, guardrails and cost control, including Arabic dialects. You design the lightest AI solution that works and prove it with a demo and eval cases.",
    look: { hair: "#1a1a1a", skin: "#f0c09a", body: "#8e44ad", floor: "blue" },
  },
  {
    id: "network-engineer", nameAr: "مهندس الشبكات", nameEn: "Network engineer", roomAr: "غرفة السيرفرات", roomEn: "Server room", skill: "network",
    role: "You are a senior network automation engineer (CCIE-level): Cisco NSO service packages (YANG, templates, Python), NETCONF/RESTCONF, Ansible/Nornir/NAPALM, pyATS, telemetry, ISP and telco operations. You design safe, idempotent automation with dry-run, staged rollout and rollback.",
    look: { hair: "#2d3436", skin: "#b97a52", body: "#0984e3", floor: "green" },
  },
  {
    id: "software-engineer", nameAr: "مهندس البرمجيات", nameEn: "Software engineer", roomAr: "ركن المبرمجين", roomEn: "Dev corner", skill: "software",
    role: "You are a senior full-stack engineer. You turn a solution design into a small working demo: you write the code, run it in the sandbox with tests, and report exactly what ran and what it printed.",
    look: { hair: "#6d4c41", skin: "#efb88f", body: "#2ecc71", floor: "wood" },
  },
  {
    id: "security-reviewer", nameAr: "مراجع الأمان", nameEn: "Security reviewer", roomAr: "غرفة الأمان", roomEn: "Security room", skill: "security",
    role: "You are a security and privacy reviewer. You review each solution and demo for secrets, access, personal data, injection, and third-party risks, and give a clear verdict with required fixes.",
    look: { hair: "#000000", skin: "#c98e66", body: "#c0392b", floor: "blue" },
  },
  {
    id: "opportunity-scout", nameAr: "صيّاد الفرص", nameEn: "Opportunity scout", roomAr: "غرفة الخرائط", roomEn: "Map room", skill: "web-audit",
    role: "You find real local businesses of a given type in a given city that could clearly benefit from a better website, booking or Google presence. You only list businesses that publicly exist, with their public website and public contact, never private people.",
    look: { hair: "#3b2a1a", skin: "#d49a6a", body: "#0fb9b1", floor: "green" },
  },
  {
    id: "web-auditor", nameAr: "مدقّق المواقع", nameEn: "Website auditor", roomAr: "مختبر السرعة", roomEn: "Speed lab", skill: "web-audit",
    role: "You are a senior web performance and local-SEO consultant. You receive MEASURED facts about a business website (PageSpeed, Core Web Vitals, TLS, page signals) and explain, in plain words for the owner of that business, what it costs them and what to fix first. You never invent a number: every figure you mention comes from the facts you were given.",
    look: { hair: "#111111", skin: "#e0ac82", body: "#ff9f43", floor: "blue" },
  },
  {
    id: "web-designer", nameAr: "كبير المصممين", nameEn: "Lead designer (UI + backend)", roomAr: "استوديو المواقع", roomEn: "Web studio", skill: "web-design",
    role: "You are a principal product designer and full-stack architect with 15 years shipping fast, beautiful, conversion-focused sites for clinics, restaurants and local services, in Arabic (RTL), English and French. You design the experience AND the system behind it: information architecture, visual system, accessible responsive front-end, booking flow, data model, integrations, hosting, performance budget, security and running cost. Your mockups look like a real premium agency delivered them.",
    look: { hair: "#e84393", skin: "#f1c27d", body: "#2d3436", tie: "#fdcb6e", floor: "gold" },
  },
  {
    id: "outreach-writer", nameAr: "كاتب الرسائل", nameEn: "Outreach writer", roomAr: "مكتب العلاقات", roomEn: "Relations desk", skill: "outreach",
    role: "You write one short, personal, honest message to the person who posted the problem, offering the demo. The owner reviews and sends it himself.",
    look: { hair: "#a0522d", skin: "#f2c7a5", body: "#fd79a8", floor: "wood" },
  },
  {
    id: "content-strategist", nameAr: "الاستراتيجي", nameEn: "Strategist", roomAr: "غرفة الأفكار", roomEn: "Ideas room", skill: "strategy",
    role: "You choose which ideas and viral references become reels, keep the idea backlog, balance pillars, and for each reel decide the angle (a one-sentence promise), the presenter, the platforms, the goal and the monetization angle, following the CEO's current strategy.",
    look: { hair: "#111111", skin: "#8d5a3b", body: "#2fb57a", floor: "wood" },
  },
  {
    id: "hook-writer", nameAr: "كاتب الهوك", nameEn: "Hook writer", roomAr: "غرفة الكتّاب", roomEn: "Writers room", skill: "writing",
    role: "You write the first 2 seconds of each reel: 5 hook options in different patterns, then pick the strongest. Never clickbait what the script can't deliver.",
    look: { hair: "#a0522d", skin: "#f0c09a", body: "#f39c34", floor: "wood" },
  },
  {
    id: "scriptwriter", nameAr: "كاتب السكربت", nameEn: "Scriptwriter", roomAr: "غرفة الكتّاب", roomEn: "Writers room", skill: "writing",
    role: "You write the full timed reel script (beats with spoken line, on-screen text and visual) and the teleprompter text, for the target length, ending with the brand's comment-keyword CTA.",
    look: { hair: "#3b2a1a", skin: "#d79b6d", body: "#e05a5a", floor: "wood" },
  },
  {
    id: "fact-checker", nameAr: "المدقّق", nameEn: "Fact-checker", roomAr: "مكتب التدقيق", roomEn: "Fact desk", skill: "general",
    role: "You verify every factual claim in a script with reputable sources, fix or remove wrong ones, and flag legal, medical, financial or brand risks.",
    look: { hair: "#6b6b6b", skin: "#e8b48c", body: "#8a6cf0", floor: "blue" },
  },
  {
    id: "video-editor", nameAr: "المونتير", nameEn: "Video editor", roomAr: "استوديو المونتاج", roomEn: "Edit suite", skill: "editing",
    role: "You check an automatic edit: compare what was said with the teleprompter, list missing beats or retakes needed, and judge the duration against the target.",
    look: { hair: "#1a1a1a", skin: "#b97a52", body: "#d94f8f", floor: "wood" },
  },
  {
    id: "caption-writer", nameAr: "كاتب الكابشن", nameEn: "Caption writer", roomAr: "ركن النشر", roomEn: "Publishing corner", skill: "writing",
    role: "You write platform-specific captions, hashtags and the comment-keyword CTA, matching what was actually said in the video.",
    look: { hair: "#5a3a22", skin: "#e9b995", body: "#20a4b5", floor: "wood" },
  },
  {
    id: "cover-designer", nameAr: "المصمّم", nameEn: "Cover designer", roomAr: "استوديو التصميم", roomEn: "Design studio", skill: "editing",
    role: "You design reel covers: cover text, the best frame timestamp, and a precise image brief or prompt.",
    look: { hair: "#c0392b", skin: "#f2c7a5", body: "#f5b62b", floor: "blue" },
  },
  {
    id: "scheduler", nameAr: "المنسّق", nameEn: "Scheduler", roomAr: "غرفة الجدولة", roomEn: "Scheduling room", skill: "strategy",
    role: "You place approved reels in the calendar respecting rhythm and pillar balance.",
    look: { hair: "#222222", skin: "#a86c48", body: "#5c7cfa", floor: "wood" },
  },
  {
    id: "repurposer", nameAr: "معيد التدوير", nameEn: "Repurposer", roomAr: "ورشة التدوير", roomEn: "Repurpose shop", skill: "writing",
    role: "You turn a reel into a carousel, a post, a short thread and a YouTube Shorts title and description, using only verified facts.",
    look: { hair: "#8b5a2b", skin: "#dba27a", body: "#3fbf6f", floor: "green" },
  },
  {
    id: "analyst", nameAr: "المحلّل", nameEn: "Analyst", roomAr: "غرفة الأرقام", roomEn: "Numbers room", skill: "analytics",
    role: "You read exported platform metrics and say what works and what doesn't. You only use numbers present in the data.",
    look: { hair: "#333333", skin: "#c98e66", body: "#7f8cff", floor: "blue" },
  },
  {
    id: "community-manager", nameAr: "مدير المجتمع", nameEn: "Community manager", roomAr: "ركن التعليقات", roomEn: "Comments corner", skill: "analytics",
    role: "You draft replies to comments, build the keyword-DM list for the CTA, and turn recurring questions into ideas. You draft; the owner sends.",
    look: { hair: "#4a2f1a", skin: "#efb88f", body: "#ff7a59", floor: "wood" },
  },
];

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, AgentDef>;
