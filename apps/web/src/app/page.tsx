import Link from "next/link";
import { LangToggle } from "@/components/LangToggle";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";

const FEATURES_AR = [
  ["12 موظف ذكاء اصطناعي", "ترند، أفكار، هوك، سكربت، تدقيق، مونتاج، كابشن، غلاف، جدولة، تدوير، أرقام، تعليقات"],
  ["مونتاج تلقائي", "قصّ السكوت، ترجمة عربية، فيديو عمودي جاهز للنشر"],
  ["ملخّص الصبح", "كل يوم الساعة 7:30 يجهّز الفريق شغله ويقول لك بالضبط ما دورك"],
  ["فريق يتعلّم", "اجتماع أسبوعي يحوّل أرقامك وتعديلاتك إلى قواعد جديدة، وكل موظف يرتقي مستوى"],
];
const FEATURES_EN = [
  ["12 AI employees", "Trends, ideas, hooks, scripts, fact-check, editing, captions, covers, scheduling, repurposing, analytics, comments"],
  ["Automatic editing", "Silence cutting, subtitles, vertical video ready to post"],
  ["Morning brief", "Every day at 7:30 the team prepares the work and tells you exactly your part"],
  ["A team that learns", "A weekly meeting turns your numbers and corrections into new rules; every agent levels up"],
];

export default async function Landing() {
  const [{ t, locale }, user] = await Promise.all([getT(), currentUser()]);
  const features = locale === "ar" ? FEATURES_AR : FEATURES_EN;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <span className="font-display text-xl font-extrabold">{t.brand}</span>
        <div className="flex items-center gap-2">
          <LangToggle locale={locale} label={t.language} back="/" />
          <Link className="btn-ghost" href={user ? "/app" : "/login"}>{user ? t.nav.home : t.login}</Link>
        </div>
      </header>
      <section className="py-16 text-center sm:py-24">
        <p className="font-pixel text-[10px] text-gold">LIVE · AI CONTENT STUDIO</p>
        <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">{t.tagline}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">{t.heroSub}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link className="btn-gold px-6 py-3 text-base" href={user ? "/app" : "/signup"}>{t.startFree}</Link>
        </div>
      </section>
      <section className="grid gap-4 pb-16 sm:grid-cols-2">
        {features.map(([title, body]) => (
          <div key={title} className="card">
            <h2 className="font-display text-xl font-bold text-gold">{title}</h2>
            <p className="mt-2 text-muted">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
