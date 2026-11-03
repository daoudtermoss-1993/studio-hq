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
      const viral = [...prompt.matchAll(/VIRAL#([\w-]+)/g)].map((m) => m[1]);
      const mode = /PRESENTER MODE: (\w+)/.exec(prompt)?.[1] ?? "self";
      return {
        newIdeas: [{ pillar: "أدوات", text: "مقارنة أداتين للمونتاج", angle: "مين أسرع؟", source: "", score: 12 }],
        picks: Array.from({ length: n }, (_, i) => ({
          title: TOPICS[(counter + i) % TOPICS.length],
          pillar: i % 2 ? "قصص" : "أدوات",
          angle: "وعد واضح بأقل من دقيقة",
          source: "trend",
          questions: [],
          presenter: mode === "avatar" ? "avatar" : mode === "auto" ? (i % 2 ? "self" : "avatar") : "self",
          viralId: viral[i] ?? null,
          platforms: ["instagram", "tiktok", "youtube"],
          goal: i % 2 ? "leads" : "reach",
          monetization: i % 2 ? "كلمة «مدير» بالتعليقات ← رسالة خاصة ← قائمة واتساب" : "انتشار يقرّب من شروط YouTube",
          why: "فكرة منتشرة هالأسبوع وبتناسب محور الأدوات",
        })),
      };
    }
    case "viral-hunter":
      return {
        youtubeQueries: ["AI tools", "ذكاء اصطناعي"],
        finds: [
          { platform: "tiktok", url: `https://www.tiktok.com/@creator/video/7${counter}01`, title: "I replaced my team with AI", creator: "@creator", views: 2400000, creatorFollowers: 80000, publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), description: "talking head, 35s", whyPicked: "outlier ×30" },
          { platform: "instagram", url: `https://www.instagram.com/reel/C${counter}xyz/`, title: "3 AI tools nobody talks about", creator: "@tools", views: 900000, creatorFollowers: 300000, publishedAt: new Date(Date.now() - 86_400_000).toISOString(), description: "list format", whyPicked: "fast growth" },
        ],
      };
    case "viral-analyst":
      return {
        hookType: "bold claim",
        hookParaphrase: "ادعاء صادم بأول ثانيتين عن استبدال فريق كامل",
        structure: [{ start: 0, end: 2, what: "ادعاء صادم" }, { start: 2, end: 15, what: "إثبات على الشاشة" }, { start: 15, end: 30, what: "3 أمثلة سريعة" }, { start: 30, end: 35, what: "دعوة للتعليق" }],
        format: "talking head + screen recording",
        pacing: "قص كل 2-3 ثواني",
        emotion: "فضول + خوف من التأخر",
        whyItWorks: ["الهوك بيوقف التمرير", "إثبات بصري سريع", "دعوة واضحة للتعليق"],
        audienceSignal: "التعليقات عم تطلب الأدوات",
        fitScore: 9,
        remake: { title: "فريقي كلّو AI… وهيك بشتغل", angle: "تجربتي الحقيقية بالعربي", ourTwist: "مثال من شغلنا ولقطة من المكتب المباشر", beatsOutline: ["ادعاء بأول ثانيتين", "لقطة المكتب", "3 موظفين بالأسماء", "اكتب «مدير»"] },
        reactIdea: "Stitch: هيدا صح بس ناقصو شغلة…",
        risks: ["ما منستعمل ولا لقطة من الفيديو الأصلي"],
      };
    case "ceo-strategy":
      return {
        summary: "نركّز على YouTube Shorts للربح الطويل، وعلى Instagram لبناء قائمة leads، وTikTok للانتشار بس",
        platforms: [
          { platform: "youtube", role: "ربح طويل المدى", monetizationPath: "YPP: 1,000 مشترك + 10M مشاهدة Shorts", availableInCountry: "yes", nextMilestone: "100 مشترك", actions: ["3 Shorts بالأسبوع", "عنوان قوي لكل Short"] },
          { platform: "tiktok", role: "انتشار", monetizationPath: "Creator Rewards غير متاح بلبنان: LIVE وعروض تجارية", availableInCountry: "no", nextMilestone: "1,000 متابع لفتح LIVE", actions: ["نفس الريلز مع هوك أسرع"] },
          { platform: "instagram", role: "leads وعروض تجارية", monetizationPath: "كلمة التعليق ← رسالة خاصة ← عرض", availableInCountry: "partial", nextMilestone: "100 lead", actions: ["كلمة «مدير» بكل ريل"] },
        ],
        revenueStreams: [{ name: "قائمة leads", how: "برومبت مجاني مقابل رقم واتساب", when: "من هلّق" }, { name: "عروض تجارية", how: "media kit بعد 10k متابع متفاعل", when: "بعد 3 أشهر" }],
        presenterPolicy: "التوأم للشرح والأخبار، إنت للقصص الشخصية",
        weeklyFocus: "سلسلة «فريقي كلّو AI» 3 أجزاء",
        risks: ["لازم تحط علامة AI على فيديوهات التوأم"],
      };
    case "problem-hunter":
      return {
        queries: [
          { source: "stackexchange", q: "NSO re-deploy", where: "networkengineering" },
          { source: "reddit", q: "whatsapp booking clinic", where: "smallbusiness" },
        ],
        finds: [
          { track: "smb", url: `https://www.facebook.com/groups/lb-business/posts/${counter}`, title: "مطعم: ما عم نلحّق نرد عالطلبات عالواتساب", body: "كل ليلة عم نخسر طلبات", author: "abou.samir", organization: "مطعم أبو سمير", contact: "", postedAt: new Date(Date.now() - 86_400_000).toISOString() },
        ],
      };
    case "chief-engineer":
      return {
        canSolve: true, fitScore: 8, valueEstimate: "بيخسرو حوالي 20 طلب بالأسبوع", reachable: true,
        assignee: /^PROBLEM \(technical/m.test(prompt) ? "network-engineer" : "automation-engineer",
        effortDays: { best: 2, likely: 4, worst: 7 }, price: { setup: "$400", monthly: "$50", currency: "USD" },
        why: "مشكلة متكررة وحلّها واضح بالأتمتة", rejectReason: "", questions: [],
      };
    case "solution":
      if (/^PROBLEM \(technical/m.test(prompt))
        return {
          summary: "إصلاح الـ re-deploy بـ NSO: sync-from قبل الـ commit واستعمال commit dry-run للتأكد",
          rootCause: "الـ CDB مش متطابق مع الجهاز بعد تغيير يدوي، فالـ service عم يرجع يكتب فوق config قديم",
          approach: "check-sync ← compare-config ← sync-from ← re-deploy dry-run ← re-deploy",
          architecture: ["NSO action بيعمل check-sync", "Python script بيقرأ الـ diff", "re-deploy بعد dry-run", "تقرير بالنتيجة"],
          steps: ["devices device X check-sync", "compare-config وتسجيل الفرق", "sync-from أو sync-to حسب القرار", "re-deploy dry-run ثم re-deploy", "اختبار بـ netsim"],
          stack: ["Cisco NSO", "Python (ncs.maapi)", "netsim"], runningCost: "ما في كلفة إضافية", risks: ["sync-from بيمحي تغييرات ما بدنا نخسرها"],
          demoPlan: "سكربت Python بيحاكي check-sync والـ diff وبيقرر الخطوة", sources: ["https://developer.cisco.com/docs/nso/"],
        };
      return {
        summary: "رد أوتوماتيكي عالواتساب بياخد الطلب ويحطو بجدول المطبخ",
        rootCause: "ما في حدا يرد بعد الساعة 10 بالليل",
        approach: "WhatsApp Cloud API + n8n + Google Sheets",
        architecture: ["WhatsApp Cloud API webhook", "n8n workflow", "Google Sheet للطلبات", "إشعار للمطبخ"],
        steps: ["فتح حساب WhatsApp Business Platform", "workflow بـ n8n", "قالب رسالة تأكيد", "تجربة وتسليم"],
        stack: ["WhatsApp Cloud API", "n8n", "Google Sheets"], runningCost: "حوالي $10 بالشهر", risks: ["موافقة Meta على القوالب"],
        demoPlan: "سكربت Python بيحاكي رسالة واتساب وبيطلّع الطلب منظّم", sources: ["https://developers.facebook.com/docs/whatsapp/cloud-api"],
      };
    case "demo":
      return {
        files: [
          { path: "order_bot.py", content: "import re\n\ndef parse(msg):\n    m = re.findall(r'(\\d+)\\s*(\\w+)', msg)\n    return [{'qty': int(q), 'item': i} for q, i in m]\n" },
          { path: "test_order_bot.py", content: "from order_bot import parse\n\ndef test_parse():\n    assert parse('2 shawarma 1 fries') == [{'qty': 2, 'item': 'shawarma'}, {'qty': 1, 'item': 'fries'}]\n" },
        ],
        howToRun: "pip install pytest && pytest -q", testCommand: "pytest -q", testOutput: "1 passed in 0.01s", works: true, limitations: ["الواتساب الحقيقي محاكى"],
      };
    case "security-reviewer":
      return { verdict: "approve", issues: [{ severity: "medium", issue: "رقم الزبون بينحفظ بالجدول", fix: "حذف الأرقام بعد 30 يوم" }], summary: "آمن للديمو" };
    case "outreach-writer":
      return {
        channel: "facebook dm", message: "مرحبا، شفت إنكن عم تخسرو طلبات بالليل. عملت ديمو صغير بيرد لحالو عالواتساب وبيحط الطلب بجدول المطبخ. بتحب ابعتلك فيديو دقيقة؟",
        followUp: "بس حبيت ذكّر بالديمو، إذا مش وقتو هلّق ما في مشكلة 🙏", publicReply: "", personalization: "ذكرت الطلبات بالليل",
      };
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
