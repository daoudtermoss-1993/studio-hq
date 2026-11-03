import Link from "next/link";
import type { Brief as BriefData } from "@studio/core";
import { answer } from "@/app/actions/studio";
import type { T } from "@/lib/i18n";

const KIND_STYLE: Record<string, string> = {
  record: "bg-coral text-white", approve: "bg-gold text-gold-ink", answer: "bg-sky text-ink", post: "bg-ok text-ink", lessons: "bg-[#b79cff] text-ink",
};

export function Brief({ t, brief, locale }: { t: T; brief: BriefData; locale: string }) {
  const date = new Date(`${brief.date}T08:00:00`).toLocaleDateString(locale === "ar" ? "ar-LB" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="card">
      <h2 className="font-display text-lg font-extrabold text-gold">⏰ {t.briefTitle}</h2>
      <p className="text-sm text-muted">{date}</p>
      <ul className="mt-3 divide-y divide-line">
        {brief.needs.length === 0 && <li className="py-3 text-sm text-muted">{t.nothingForYou}</li>}
        {brief.needs.map((n, i) => (
          <li key={i} className="py-3">
            <div className="flex items-start gap-2">
              <span className={`chip shrink-0 ${KIND_STYLE[n.kind]}`}>{t.need[n.kind]}</span>
              <div className="min-w-0 flex-1 text-sm">
                {n.kind === "lessons" ? (
                  <Link href="/app/meeting" className="underline">{t.needText.lessons} ({n.title})</Link>
                ) : n.kind === "answer" ? (
                  <>
                    <p className="bidi">{t.reel} {n.reelNumber}: {n.title}</p>
                    <form action={answer} className="mt-2 flex gap-2">
                      <input type="hidden" name="reelId" value={n.reelId} />
                      <input type="hidden" name="questionId" value={n.questionId} />
                      <input name="answer" className="input py-1.5" placeholder={t.answer} required />
                      <button className="btn-ghost py-1.5">{t.send}</button>
                    </form>
                  </>
                ) : (
                  <Link href={`/app/reels/${n.reelNumber}`} className="bidi hover:underline">
                    {t.needText[n.kind as "record" | "approve" | "post"]} {n.reelNumber}: {n.title}
                  </Link>
                )}
                {n.kind === "record" && (
                  <Link href={`/tp/${n.reelNumber}`} target="_blank" className="mt-1 block text-xs text-gold">🎙️ {t.openTeleprompter}</Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-bold text-muted">{t.pipeline}</h3>
      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {Object.entries(brief.pipeline).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-ink p-2 text-center">
            <b className="block text-lg">{v}</b>
            <span className="text-[11px] text-muted">{t.status[k as keyof T["status"]]}</span>
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-sm font-bold text-muted">{t.upcoming}</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {brief.upcoming.length === 0 && <li className="text-muted">{t.noneScheduled}</li>}
        {brief.upcoming.map((u) => (
          <li key={u.reelId}>
            <Link href={`/app/reels/${u.number}`} className="bidi hover:underline">
              {new Date(u.publishAt).toLocaleString(locale === "ar" ? "ar-LB" : "en-GB", { timeZone: brief.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {t.reel} {u.number}: {u.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
