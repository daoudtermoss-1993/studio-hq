/** Deterministic consulting-team answers for AI_PROVIDER=mock (demos and tests). Numbers mirror the example in the method doc. */

const company = (prompt: string) => prompt.match(/^COMPANY: (.+)$/m)?.[1]?.trim() ?? "الشركة";

export function mockResearch(prompt: string) {
  const c = company(prompt);
  return {
    summary: `${c} شركة خدمات إنترنت متوسطة، الدعم الفني عندها عم يكبر أسرع من الفريق.`,
    whatTheyDo: "إنترنت منزلي وللشركات، دعم فني بالتلفون والواتساب",
    size: "حوالي 80 موظف",
    systems: ["نظام تذاكر", "Zabbix للمراقبة", "واتساب Business"],
    signals: [
      { signal: "إعلان توظيف لـ 3 موظفين دعم فني", source: "https://example.com/jobs" },
      { signal: "تعليقات زباين عن التأخير بالرد وقت الأعطال", source: "https://example.com/reviews" },
    ],
    likelyPains: [
      { pain: "نفس الأسئلة بتتكرر بالدعم", why: "عم يوظّفوا لنفس الوظيفة" },
      { pain: "زحمة تلفونات وقت العطل العام", why: "الزباين بيشتكوا من التأخير" },
    ],
    firstCallQuestions: ["كم تذكرة بالشهر؟", "قديش بتاخد التذكرة؟", "شو بيصير وقت العطل العام؟", "وين قاعدة الداتا؟", "مين لازم يوافق؟"],
    redFlags: [],
    sources: ["https://example.com/jobs", "https://example.com/reviews"],
  };
}

export function mockInterview(prompt: string) {
  const role = prompt.match(/^INTERVIEW ROLE: (\w+)/m)?.[1] ?? "other";
  if (role === "finance")
    return {
      summary: "كلفة ساعة موظف الدعم حوالي $6، وعم يفكّروا يوظّفوا 3.",
      tasks: [{ task: "توظيف دعم إضافي", who: "الإدارة", timesPerMonth: null, minutesEach: null, saidBy: "المالية", quote: "عم نفكّر نوظّف 3 كمان" }],
      hourlyCost: 6, systems: [], data: [], constraints: ["الميزانية محدودة هالسنة"], risks: [], openQuestions: ["قديش بيكلّف زبون بيفلّ؟"],
    };
  return {
    summary: "الفريق بيرد على نفس الأسئلة طول النهار، ووقت العطل العام التلفونات ما بتوقف.",
    tasks: [
      { task: "الرد على أسئلة الدعم المتكررة", who: "فريق الدعم", timesPerMonth: 3000, minutesEach: 9, saidBy: "مسؤول الدعم", quote: "حوالي 3000 تذكرة بالشهر، كل وحدة 9 دقايق" },
      { task: "تجميع بلاغات العطل العام", who: "فريق الدعم", timesPerMonth: 600, minutesEach: 3, saidBy: "مسؤول الدعم", quote: "وقت العطل بيجي 600 اتصال عن نفس الشي" },
    ],
    hourlyCost: null,
    systems: ["نظام تذاكر", "Zabbix"],
    data: ["آخر 500 تذكرة", "مستندات الدعم"],
    constraints: ["الداتا ما بتطلع برّا سيرفراتن"],
    risks: ["الموظفين خايفين المساعد ياخد شغلن"],
    openQuestions: ["قديش بتكلّف ساعة الموظف؟"],
  };
}

export function mockOpportunities() {
  return {
    summary: "أقوى بداية: مسودات ردود الدعم، لأنو الداتا موجودة والقيمة عالية.",
    items: [
      {
        id: "support-drafts", title: "مسودات ردود الدعم", problem: "نفس الأسئلة بتاخد 9 دقايق كل مرة", solution: "مساعد بيقرا التذكرة وتاريخ التذاكر وبيكتب مسودة جواب للموظف",
        value: 5, ease: 4, speed: 4, inputs: { tasksPerMonth: 3000, minutesSaved: 4, hourlyCost: 6, runningMonthly: 150, setupCost: 0 },
        inputSources: { tasksPerMonth: "interview: مسؤول الدعم", minutesSaved: "assumption", hourlyCost: "interview: المالية" },
        dataNeeded: ["آخر 500 تذكرة", "مستندات الدعم"], risks: ["جواب غلط إذا ما في مراجعة"], redFlags: [],
      },
      {
        id: "outage-digest", title: "تجميع بلاغات الأعطال", problem: "600 اتصال عن نفس العطل", solution: "بيجمّع البلاغات وبيقول «في عطل عام بهالمنطقة» مع رسالة جاهزة",
        value: 4, ease: 4, speed: 5, inputs: { tasksPerMonth: 600, minutesSaved: 2, hourlyCost: 6, runningMonthly: 40, setupCost: 0 },
        inputSources: { tasksPerMonth: "interview: مسؤول الدعم", minutesSaved: "assumption", hourlyCost: "interview: المالية" },
        dataNeeded: ["alarms من Zabbix", "مناطق الزباين"], risks: [], redFlags: [],
      },
      {
        id: "fault-prediction", title: "توقّع الأعطال من الـ logs", problem: "الأعطال بتنعرف من الزباين قبل الفريق", solution: "موديل بيقرا الـ logs وبيحذّر قبل",
        value: 5, ease: 2, speed: 2, inputs: { tasksPerMonth: 20, minutesSaved: 120, hourlyCost: 6, runningMonthly: 300, setupCost: 5000 },
        inputSources: { tasksPerMonth: "assumption", minutesSaved: "assumption", hourlyCost: "interview: المالية" },
        dataNeeded: ["logs سنة"], risks: ["بدّا داتا كتير"], redFlags: [],
      },
      {
        id: "generic-chatbot", title: "شات بوت عام عالموقع", problem: "بدّن «AI» عالموقع", solution: "شات بوت بلا داتا",
        value: 2, ease: 3, speed: 3, inputs: { tasksPerMonth: 100, minutesSaved: 1, hourlyCost: 6, runningMonthly: 50, setupCost: 0 },
        inputSources: { tasksPerMonth: "assumption", minutesSaved: "assumption", hourlyCost: "interview: المالية" },
        dataNeeded: [], risks: [], redFlags: ["ما في داتا يجاوب منها"],
      },
    ],
  };
}

export function mockProposal(prompt: string) {
  const c = company(prompt);
  const pilot = /KIND: pilot/.test(prompt);
  return {
    title: pilot ? `تجربة: مسودات ردود الدعم — ${c}` : `تقييم فرص الـ AI — ${c}`,
    problemInTheirWords: "«الدعم عم يغرق بنفس الأسئلة، وعم نفكّر نوظّف 3 كمان»",
    approach: pilot ? "مساعد بيكتب مسودة والموظف بيوافق، على سيرفراتكن، مع قياس قبل وبعد" : "أسبوعين: مقابلات ومراقبة، تحليل الداتا، فرص بالأرقام، demo",
    deliverables: pilot ? ["مساعد شغّال بوضع المسودة", "تقرير قبل وبعد", "تدريب الفريق"] : ["خريطة الشغل الحالي", "3 لـ 5 فرص بالأرقام", "demo لأقوى فكرة", "توصية بتجربة"],
    timeline: pilot
      ? [{ when: "أسبوع 1", what: "تجهيز بمحيطكن" }, { when: "أسبوع 2-3", what: "بناء واختبار" }, { when: "أسبوع 4", what: "وضع المسودة" }, { when: "أسبوع 5-6", what: "قياس وتسليم" }]
      : [{ when: "أسبوع 1", what: "مقابلات ومراقبة وتحليل" }, { when: "أسبوع 2", what: "الفرص والـ demo والعرض النهائي" }],
    weNeed: ["عيّنة 500 تذكرة", "ساعة مع كل شخص"],
    outOfScope: ["ربط أنظمة جديدة", "تدريب موديلات"],
    successMeasure: pilot ? "دقايق التذكرة نزلت والفريق موافق عالمسودات" : "قرار واضح بتجربة وحدة بأرقامها",
    coverEmail: { subject: pilot ? "عرض التجربة" : "عرض التقييم", body: "مرحبا، متل ما اتفقنا، هيدا العرض بصفحة وحدة. إذا في أي سؤال أنا حاضر." },
  };
}

export function mockPilotPlan() {
  return {
    weeks: [
      { week: "أسبوع 1", goal: "تجهيز", tasks: ["حساب cloud باسم الشركة", "وصول read-only للتذاكر"] },
      { week: "أسبوع 2-3", goal: "بناء", tasks: ["قراءة التذاكر", "كتابة المسودات", "اختبار مع موظفين"] },
      { week: "أسبوع 4", goal: "وضع المسودة", tasks: ["الموظف بيوافق أو بيعدّل كل مسودة"] },
      { week: "أسبوع 5-6", goal: "قياس وتسليم", tasks: ["قياس بعد", "تقرير", "تدريب"] },
    ],
    metrics: [
      { key: "minutes-per-ticket", name: "دقايق التذكرة", unit: "دقيقة", kind: "minutes-per-task", higherIsBetter: false, howToMeasure: "متوسط وقت الإغلاق من نظام التذاكر لـ 100 تذكرة" },
      { key: "tickets-per-month", name: "تذاكر بالشهر", unit: "تذكرة", kind: "tasks-per-month", higherIsBetter: true, howToMeasure: "عدد التذاكر من نظام التذاكر" },
      { key: "draft-acceptance", name: "مسودات انقبلت بلا تعديل", unit: "%", kind: "other", higherIsBetter: true, howToMeasure: "نسبة المسودات اللي الموظف بعتها متل ما هي" },
    ],
    dataAccess: ["read-only على نظام التذاكر", "API بحساب الشركة"],
    humanInLoop: "كل مسودة بيوافق عليها موظف قبل ما تطلع",
    rollback: "نطفي المساعد والفريق بيرجع يشتغل متل قبل",
    risks: ["الموظفين ما يثقوا بالمسودات بالأول"],
  };
}

export function mockPilotReport(prompt: string) {
  const realized = prompt.match(/"realizedMonthly":(\d+)/)?.[1];
  return {
    headline: realized ? `التجربة عم توفّر $${realized} بالشهر` : "التجربة ماشية، ناطرين القياس",
    wins: realized ? ["دقايق التذكرة نزلت"] : [],
    issues: realized ? [] : ["ما في قياس بعد"],
    next: "نكمّل أسبوعين ونقيس مرة تانية",
    clientMessage: realized ? `مرحبا، أول أرقام التجربة: توفير $${realized} بالشهر. بخبّرك بالتفاصيل بالاجتماع.` : "مرحبا، التجربة ماشية، أول أرقام الأسبوع الجاي.",
  };
}

export function mockConsultingDemo() {
  return {
    files: [
      { path: "drafts.py", content: "FAQ = {'speed': 'Restart the router, then check the line light.', 'bill': 'Your bill is in the portal under Billing.'}\n\ndef draft(ticket):\n    t = ticket.lower()\n    for k, v in FAQ.items():\n        if k in t:\n            return {'draft': v, 'needs_human': False}\n    return {'draft': '', 'needs_human': True}\n" },
      { path: "test_drafts.py", content: "from drafts import draft\n\ndef test_known():\n    assert draft('My speed is slow')['draft']\n\ndef test_unknown_goes_to_human():\n    assert draft('I want to cancel')['needs_human']\n" },
    ],
    howToRun: "pip install pytest && pytest -q", testCommand: "pytest -q", testOutput: "2 passed in 0.01s", works: true,
    limitations: ["الموديل محاكى بقاموس صغير", "داتا اصطناعية"],
  };
}
