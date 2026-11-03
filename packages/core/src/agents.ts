import type { SkillId } from "./skills";

export type AgentId =
  | "ceo"
  | "trend-scout"
  | "viral-hunter"
  | "viral-analyst"
  | "digital-twin"
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
