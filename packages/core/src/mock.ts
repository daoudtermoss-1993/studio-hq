/**
 * Deterministic fake agents for local demos and automated tests (AI_PROVIDER=mock).
 * They return schema-valid content so the whole pipeline runs without an API key.
 */
const TOPICS = [
  "3 أدوات بتوفّرلك ساعة باليوم",
  "الذكاء الاصطناعي ما رح ياخد شغلك",
  "عندي شركة فيها 15 موظف",
  "برومبت واحد بيكتبلك أسبوع محتوى",
  "غلطة بتعملها كل يوم بـ ChatGPT",
  "كيف تصوّر ريل بموبايل بس",
];
let counter = 0;

function pickCount(prompt: string) {
  const m = prompt.match(/pick exactly (\d+)/i);
  return m ? Number(m[1]) : 1;
}

export function mockAgent(agent: string, prompt: string): unknown {
  counter++;
  switch (agent) {
    case "trend-scout":
      return {
        trends: [
          { title: "أداة جديدة لتحويل الفيديو لنص", whyItMatters: "بتوفّر وقت المونتاج", angle: "جرّبتها على ريل حقيقي", sources: ["https://example.com/a"], freshness: "hot", confirmed: true },
          { title: "شو عم يسألوا الناس عن الذكاء الاصطناعي بالشغل", whyItMatters: "خوف من خسارة الشغل", angle: "كيف تستعملو لصالحك", sources: ["https://example.com/b"], freshness: "warm", confirmed: true },
        ],
      };
    case "content-strategist": {
      const n = pickCount(prompt);
      return {
        newIdeas: [{ pillar: "أدوات", text: "مقارنة أداتين للمونتاج", angle: "مين أسرع؟", source: "", score: 12 }],
        picks: Array.from({ length: n }, (_, i) => ({
          title: TOPICS[(counter + i) % TOPICS.length],
          pillar: i % 2 ? "قصص" : "أدوات",
          angle: "وعد واضح بأقل من دقيقة",
          source: "trend",
          questions: [],
        })),
      };
    }
    case "hook-writer":
      return {
        hooks: [
          { pattern: "bold claim", spoken: "عندي شركة فيها 15 موظف، ولا واحد فيهم إنسان", onScreen: "15 موظف… ولا إنسان" },
          { pattern: "number", spoken: "3 أدوات بتوفّرلك ساعة كل يوم", onScreen: "3 أدوات = ساعة" },
          { pattern: "question", spoken: "بعدك عم تكتب كل شي بإيدك؟", onScreen: "بعدك بإيدك؟" },
          { pattern: "contrast", spoken: "كنت إقضي 4 ساعات، هلّق 10 دقايق", onScreen: "4 ساعات ← 10 دقايق" },
          { pattern: "warning", spoken: "وقّف تعمل هالغلطة", onScreen: "وقّف!" },
        ],
        chosenIndex: 0,
        why: "الادعاء الجريء بيوقّف التمرير",
      };
    case "scriptwriter":
      return {
        beats: [
          { start: 0, end: 2, spoken: "عندي شركة فيها 15 موظف، ولا واحد فيهم إنسان", onScreen: "15 موظف… ولا إنسان", visual: "وجّ قريب" },
          { start: 2, end: 10, spoken: "أنا ما بحكي إلا مع واحد منهم: المدير", onScreen: "المدير", visual: "لقطة شاشة" },
          { start: 10, end: 30, spoken: "واحد بيدوّر على الترند، واحد بيكتب، وواحد بيمنتج", onScreen: "ترند · كتابة · مونتاج", visual: "المكتب المباشر" },
          { start: 30, end: 40, spoken: "إذا بدّك البرومبت، اكتب مدير بالتعليقات", onScreen: "اكتب «مدير»", visual: "وجّ" },
        ],
        teleprompter: "عندي شركة فيها 15 موظف.\nولا واحد فيهم إنسان.\n\nأنا ما بحكي إلا مع واحد منهم: المدير.\n\nواحد بيدوّر على الترند.\nواحد بيكتب.\nوواحد بيمنتج.\n\nإذا بدّك البرومبت، اكتب مدير بالتعليقات.",
        estimatedSeconds: 40,
        questions: [],
      };
    case "fact-checker":
      return { claims: [{ claim: "15 موظف", source: "تجربة شخصية", ok: true, fix: "" }], revisedTeleprompter: null, revisedBeats: null, blocking: false, issues: [] };
    case "video-editor":
      return { missingLines: [], retakeNeeded: false, notes: "المونتاج ماشي، المدة قريبة من الهدف" };
    case "caption-writer":
      return {
        captions: [
          { platform: "instagram", text: "شركتي كلها ذكاء اصطناعي… وأنا بس بسجّل 🎙️\nاكتب «مدير» وببعتلك البرومبت", hashtags: ["#ذكاء_اصطناعي", "#صناعة_محتوى", "#ريلز"] },
          { platform: "tiktok", text: "15 موظف ولا واحد إنسان 🤖 اكتب «مدير»", hashtags: ["#ai", "#محتوى"] },
        ],
        firstComment: "اكتب «مدير» وبوصلك البرومبت عالخاص",
      };
    case "cover-designer":
      return { coverText: "15 موظف… ولا إنسان", frameSecond: 0.5, brief: "وجّ قريب يمين، نص أبيض عريض فوق، خلفية غامقة" };
    case "repurposer":
      return {
        carousel: ["عندي شركة فيها 15 موظف", "ولا واحد فيهم إنسان", "المدير بيوزّع الشغل", "الفريق بيعمل كل شي", "اكتب «مدير»"],
        post: "بنيت فريق محتوى كامل من الذكاء الاصطناعي. أنا بسجّل وبوافق، والباقي عليهم.",
        thread: ["بنيت شركة محتوى موظفينها ذكاء اصطناعي", "كل واحد إلو دور", "وأنا شغلتي التسجيل بس"],
        shortsTitle: "15 موظف ولا واحد إنسان",
        shortsDescription: "كيف بنيت فريق محتوى من الذكاء الاصطناعي",
      };
    case "change-router":
      return { captions: /كابشن|caption/i.test(prompt) ? "عدّل حسب الطلب" : null, cover: null, video: /قص|trim|cut/i.test(prompt) ? { trimStart: 0.5, trimEnd: 0, noSubtitles: false, note: "قصّ البداية" } : null, retake: null };
    case "analyst": {
      const nums = [...prompt.matchAll(/#(\d+)\b/g)].map((m) => Number(m[1])).slice(0, 5);
      return {
        reels: nums.map((n, i) => ({ number: n, views: 1000 * (i + 1), avgWatchPct: 40 + i, likes: 50 * (i + 1), comments: 10, shares: 5, saves: 8, follows: 3 })),
        top: nums.slice(-1).map((n) => `ريل ${n}`),
        bottom: nums.slice(0, 1).map((n) => `ريل ${n}`),
        patterns: ["الهوك بالأرقام أقوى (إشارة ضعيفة)"],
        recommendations: ["جرّب هوك برقم بأول ثانيتين", "انشر الساعة 7:30", "خلّي الريل أقل من 45 ثانية"],
      };
    }
    case "community-manager":
      return { replies: [{ user: "sara", comment: "وين البرومبت؟", reply: "بعتلك ياه عالخاص 🙏" }], dmList: [{ user: "sara", message: "أهلا سارة! هيدا البرومبت متل ما وعدت" }], ideas: ["كيف تبلّش بأول agent"], flags: [] };
    case "ceo-meeting":
      return {
        lessons: [
          { skill: "writing", text: "ابدأ الهوك برقم واضح", evidence: "أفضل ريل هالأسبوع بدأ برقم" },
          { skill: "editing", text: "قصّ أول نص ثانية من كل تسجيل", evidence: "طلبات تعديل متكررة" },
        ],
        summary: "أسبوع منيح: الهوكات بالأرقام شغّالة",
        nextWeekFocus: "سلسلة «أدوات» من 3 أجزاء",
      };
    default:
      throw new Error(`mock: unknown agent ${agent}`);
  }
}
