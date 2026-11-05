import { MARKETS, SOURCES } from "@studio/core";
import type { Engagement } from "@studio/db";
import { rerunResearchAction, updateFactsAction } from "@/app/actions/consulting";
import type { T } from "@/lib/i18n";

export function ConsultBrief({ e, t, busy }: { e: Engagement; t: T; busy: boolean }) {
  const r = e.research;
  const hidden = <input type="hidden" name="engagementId" value={e.id} />;
  return (
    <div className="space-y-4">
      {!r && <p className="card text-sm text-muted">⏳ {t.cs.researching}</p>}
      {r && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gold">🔎 {t.cs.research}</h2>
            <form action={rerunResearchAction}>{hidden}<button className="btn-ghost text-sm" disabled={busy}>↻ {t.cs.rerunResearch}</button></form>
          </div>
          <p className="bidi">{r.summary}</p>
          <p className="bidi text-sm text-muted">{r.whatTheyDo}{r.size && ` · ${r.size}`}</p>
          {r.systems?.length > 0 && <p className="bidi text-sm"><span className="text-muted">{t.cs.systems}: </span>{r.systems.join(" · ")}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">{t.cs.firstCall}</h3>
              <ol className="bidi mt-1 list-decimal space-y-1 ps-5 text-sm">{r.firstCallQuestions.map((q: string) => <li key={q}>{q}</li>)}</ol>
            </div>
            <div className="space-y-3">
              {r.likelyPains?.length > 0 && (
                <div>
                  <h3 className="font-semibold">{t.cs.likelyPains}</h3>
                  <ul className="bidi mt-1 list-disc space-y-1 ps-5 text-sm">{r.likelyPains.map((p: any) => <li key={p.pain}>{p.pain} <span className="text-muted">— {p.why}</span></li>)}</ul>
                </div>
              )}
              {r.signals?.length > 0 && (
                <div>
                  <h3 className="font-semibold">{t.cs.signals}</h3>
                  <ul className="bidi mt-1 space-y-1 text-sm">
                    {r.signals.map((s: any) => (
                      <li key={s.signal}>• {s.signal}{/^https?:\/\//.test(s.source) && <> · <a className="text-sky hover:underline" href={s.source} target="_blank" rel="noreferrer">↗</a></>}</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.redFlags?.length > 0 && <p className="bidi text-sm text-coral">⚠️ {t.cs.redFlags}: {r.redFlags.join(" · ")}</p>}
            </div>
          </div>
          {r.sources?.length > 0 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">{t.cs.sourcesL} ({r.sources.length})</summary>
              <ul className="mt-1 space-y-0.5" dir="ltr">{r.sources.filter((u: string) => /^https?:\/\//.test(u)).map((u: string) => <li key={u}><a className="break-all hover:underline" href={u} target="_blank" rel="noreferrer">{u}</a></li>)}</ul>
            </details>
          )}
        </section>
      )}

      <form action={updateFactsAction} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hidden}
        {(["company", "website", "sector", "country", "size", "contactName", "contactRole", "language"] as const).map((k) => (
          <div key={k}>
            <label className="label" htmlFor={`f-${k}`}>{t.cs[k]}</label>
            <input id={`f-${k}`} name={k} dir={k === "website" || k === "language" ? "ltr" : "auto"} className="input" defaultValue={e[k]} />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="f-source">{t.cs.source}</label>
          <select id="f-source" name="source" defaultValue={e.source} className="input">{SOURCES.map((s) => <option key={s} value={s}>{t.cs.sources[s]}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="f-market">{t.cs.market}</label>
          <select id="f-market" name="market" defaultValue={e.market} className="input">{MARKETS.map((m) => <option key={m} value={m}>{t.cs.markets[m]}</option>)}</select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="f-notes">{t.cs.notes}</label>
          <textarea id="f-notes" name="notes" rows={5} dir="auto" className="input" defaultValue={e.notes} />
          <p className="mt-1 text-xs text-muted">🔒 {t.cs.privacyNote}</p>
        </div>
        <div><button className="btn-gold">{t.cs.save}</button></div>
      </form>
    </div>
  );
}
