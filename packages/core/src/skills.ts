/**
 * The team's house know-how. Each skill is shared by one or more agents; approved lessons
 * from the weekly meeting are appended to it at run time (that is how agents "level up").
 */
export type SkillId = "general" | "writing" | "strategy" | "trends" | "editing" | "analytics";

export const SKILLS: Record<SkillId, { nameAr: string; nameEn: string; rules: string }> = {
  general: {
    nameAr: "قواعد الشركة",
    nameEn: "Company rules",
    rules: `- Write in the brand's language and dialect, for its audience.
- Every factual claim needs a source or must be removed.
- Never post, DM or reply publicly: agents draft, the owner publishes.
- Never invent metrics: numbers only come from imported files.
- Respect the brand's red lines at all times.`,
  },
  writing: {
    nameAr: "الكتابة",
    nameEn: "Writing",
    rules: `HOOK PATTERNS (rotate, track which wins): bold claim · number · contrast/before-after ·
direct question · "I tested X so you don't have to" · mistake/warning.
Spoken hook ≤ 12 words, on-screen text ≤ 6 words; the payoff must arrive in the video.
SCRIPT: ~2.5 spoken words per second (45 s ≈ 110 words). One idea per sentence, short sentences,
technical words may stay in English. Something changes on screen every 5–7 s. Open a loop early
and close it before the CTA. One CTA at the end only (the comment keyword).
TELEPROMPTER: spoken lines only, one sentence per line, empty line between beats, numbers as spoken.
CAPTIONS: line 1 is a second hook (≤ 90 chars); don't repeat the video; CTA keyword;
hashtags IG 3–5, TikTok 3–4, FB 0–2, YouTube 0–3; max 3 emoji.`,
  },
  strategy: {
    nameAr: "الاستراتيجية",
    nameEn: "Strategy",
    rules: `Score ideas 1–5 on fit (pillar + real audience problem), freshness, explainability (< 60 s, clear payoff);
keep ideas ≥ 11/15. Over the last 10 reels no pillar above 40 %. Mix ~60 % value, ~25 % story/opinion,
~15 % trend reaction. A format that works becomes a numbered series. Group reels with the same
recording setup so the owner can batch-record.`,
  },
  trends: {
    nameAr: "الترند",
    nameEn: "Trends",
    rules: `Official sources first (product blogs, changelogs, press releases), then reputable news and
aggregators, then the audience's regional sources and language. Freshness: < 72 h hot, < 2 weeks warm,
older only if evergreen. Confirmed = official source or 2 independent reputable sources, otherwise
mark unconfirmed. Always say what OUR angle is (local angle, demo, personal test).`,
  },
  editing: {
    nameAr: "المونتاج",
    nameEn: "Editing",
    rules: `Compare the transcript with the teleprompter: missing beat, repeated take, wrong subtitle words.
Final duration within ±15 % of target. The hook starts at 0.0 s. Subtitles in the safe zone.
Cover text ≤ 5 words, readable on a phone grid, consistent position across reels; avoid the bottom 20 %
and right 15 % of the frame.`,
  },
  analytics: {
    nameAr: "الأرقام والمجتمع",
    nameEn: "Analytics & community",
    rules: `Order of importance: 3-second hold, average watch %, shares and saves per 1,000 views,
comments (CTA keyword comments are leads), follows per 1,000 views. Compare on ratios, same age window.
Fewer than 3 reels supporting a pattern = weak signal, never a rule.
Community: answer questions and first comments fast; keyword DM = exactly the promised resource + thanks,
no upsell in the first message; skip spam and insults, flag anything sensitive to the owner.`,
  },
};
