import { INTERVIEW_ROLES, QUESTION_BANK } from "@studio/core";
import type { Engagement, EngagementInterview } from "@studio/db";
import { addInterviewAction } from "@/app/actions/consulting";
import type { T } from "@/lib/i18n";

export function ConsultInterviews({ e, t, ivs }: { e: Engagement; t: T; ivs: EngagementInterview[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="space-y-4">
        <form action={addInterviewAction} className="card space-y-3">
          <input type="hidden" name="engagementId" value={e.id} />
          <h2 className="font-bold text-gold">＋ {t.cs.addInterview}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="role">{t.cs.role}</label>
              <select id="role" name="role" className="input">{INTERVIEW_ROLES.map((r) => <option key={r} value={r}>{t.cs.roles[r]}</option>)}</select>
            </div>
            <div><label className="label" htmlFor="person">{t.cs.person}</label><input id="person" name="person" dir="auto" className="input" placeholder="مسؤول الدعم" /></div>
          </div>
          <div>
            <label className="label" htmlFor="ivnotes">{t.cs.interviewNotes}</label>
            <textarea id="ivnotes" name="notes" required rows={7} dir="auto" className="input" />
            <p className="mt-1 text-xs text-muted">🔒 {t.cs.privacyNote}</p>
          </div>
          <button className="btn-gold">{t.cs.saveInterview}</button>
        </form>

        {ivs.length === 0 && <p className="card text-sm text-muted">{t.cs.noInterviews}</p>}
        {[...ivs].reverse().map((iv) => {
          const s = iv.synthesis;
          return (
            <article key={iv.id} className="card space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-sky text-ink">{t.cs.roles[iv.role as keyof typeof t.cs.roles] ?? iv.role}</span>
                {iv.person && <span className="bidi font-semibold">{iv.person}</span>}
                <span className="text-xs text-muted" dir="ltr">{iv.createdAt.toISOString().slice(0, 10)}</span>
              </div>
              {!s && <p className="text-sm text-muted">⏳ {t.cs.synthesizing}</p>}
              {s && (
                <>
                  <p className="bidi">{s.summary}</p>
                  {s.tasks?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted"><tr><th className="py-1 text-start">{t.cs.tasks}</th><th className="text-start">{t.cs.perMonth}</th><th className="text-start">{t.cs.minutes}</th><th className="text-start">{t.cs.said}</th></tr></thead>
                        <tbody>
                          {s.tasks.map((k: any) => (
                            <tr key={k.task} className="border-t border-line align-top">
                              <td className="bidi py-1.5 pe-3">{k.task}{k.quote && <div className="text-xs text-muted">«{k.quote}»</div>}</td>
                              <td dir="ltr" className="pe-3 text-start">{k.timesPerMonth ?? "?"}</td>
                              <td dir="ltr" className="pe-3 text-start">{k.minutesEach ?? "?"}</td>
                              <td className="bidi text-muted">{k.saidBy || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {s.hourlyCost != null && <p>{t.cs.hourlyCost}: <b dir="ltr">${s.hourlyCost}</b></p>}
                    {s.systems?.length > 0 && <p className="bidi"><span className="text-muted">{t.cs.systems}: </span>{s.systems.join(" · ")}</p>}
                    {s.data?.length > 0 && <p className="bidi"><span className="text-muted">{t.cs.data}: </span>{s.data.join(" · ")}</p>}
                    {s.constraints?.length > 0 && <p className="bidi"><span className="text-muted">{t.cs.constraints}: </span>{s.constraints.join(" · ")}</p>}
                  </div>
                  {s.risks?.length > 0 && <p className="bidi text-sm text-coral">⚠️ {s.risks.join(" · ")}</p>}
                  {s.openQuestions?.length > 0 && (
                    <div className="text-sm"><span className="text-muted">{t.cs.openQuestions}:</span>
                      <ul className="bidi list-disc ps-5">{s.openQuestions.map((q: string) => <li key={q}>{q}</li>)}</ul>
                    </div>
                  )}
                </>
              )}
              <details className="text-xs text-muted"><summary className="cursor-pointer">{t.cs.interviewNotes}</summary><p className="bidi mt-1 whitespace-pre-wrap">{iv.notes}</p></details>
            </article>
          );
        })}
      </div>

      <aside className="card h-fit space-y-3 text-sm">
        <h2 className="font-bold text-gold">📋 {t.cs.questionBank}</h2>
        <p className="rounded-lg bg-ink-3 p-2 font-semibold">{t.cs.askAlways}</p>
        {(Object.keys(QUESTION_BANK) as (keyof typeof QUESTION_BANK)[]).map((role) => (
          <details key={role} open={role === "team"}>
            <summary className="cursor-pointer font-semibold">{t.cs.roles[role]}</summary>
            <ul className="bidi mt-1 list-disc space-y-1 ps-5 text-muted">{QUESTION_BANK[role].map((q) => <li key={q}>{q}</li>)}</ul>
          </details>
        ))}
      </aside>
    </div>
  );
}
