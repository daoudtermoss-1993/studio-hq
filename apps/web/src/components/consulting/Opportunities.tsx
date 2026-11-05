import type { ScoredOpportunity } from "@studio/core";
import type { Engagement } from "@studio/db";
import { demoAction, mapOpportunitiesAction, opportunityAction } from "@/app/actions/consulting";
import type { T } from "@/lib/i18n";
import { axisPct, moneyTone, QUADRANT_STYLE, usd } from "./style";

const QUADS = ["start-here", "later", "small-win", "avoid"] as const;

/** Value up, easier toward the reading start (right in Arabic, left in English): "start here" is the first corner the eye meets. */
function Matrix({ items, chosen, t }: { items: ScoredOpportunity[]; chosen: string | null; t: T }) {
  return (
    <figure className="space-y-1">
      <p className="text-xs font-semibold text-muted">{t.cs.valueAxis}</p>
      <div className="grid grid-cols-2 gap-1.5 text-center text-xs font-semibold text-muted"><span>{t.cs.easier}</span><span>{t.cs.harder}</span></div>
      <div className="relative">
        <div className="grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-1.5">
          {QUADS.map((q) => (
            <div key={q} className={`rounded-lg border p-2 ${q === "start-here" ? "border-ok bg-ok/10" : "border-line"}`}>
              <span className="text-xs font-bold text-muted">{t.cs.quadrants[q]}</span>
            </div>
          ))}
        </div>
        {items.map((o, i) => (
          <span key={o.id} title={o.title} aria-label={o.title}
            className={`absolute grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border-2 text-xs font-bold shadow ${o.id === chosen ? "border-gold bg-gold text-gold-ink" : "border-ink bg-sky text-ink"}`}
            style={{ insetInlineStart: `calc(${axisPct(o.ease)}% - 0.875rem)`, top: `${axisPct(o.value)}%` }}>
            {i + 1}
          </span>
        ))}
      </div>
      <figcaption className="text-xs text-muted">{t.cs.matrixTitle}</figcaption>
    </figure>
  );
}

export function ConsultOpportunities({ e, t, hasInterviews, mapping, demoBusy }: { e: Engagement; t: T; hasInterviews: boolean; mapping: boolean; demoBusy: boolean }) {
  const o = e.opportunities as { summary: string; items: ScoredOpportunity[]; recommended: string | null; pilotPrice: number } | null;
  const hidden = <input type="hidden" name="engagementId" value={e.id} />;
  const chosen = o?.items.find((i) => i.id === o.recommended) ?? null;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted">🧮 {t.cs.formula}</p>
        <form action={mapOpportunitiesAction}>{hidden}<button className="btn-gold" disabled={mapping || !hasInterviews}>{mapping ? `⏳ ${t.cs.mapping}` : `🎯 ${t.cs.mapNow}`}</button></form>
      </div>
      {!o && !mapping && <p className="card text-sm text-muted">{t.cs.noOpps}</p>}
      {o && (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="card"><Matrix items={o.items} chosen={o.recommended} t={t} /></section>
            <section className="card space-y-2">
              <p className="bidi">{o.summary}</p>
              <ol className="space-y-1.5 text-sm">
                {o.items.map((it, i) => (
                  <li key={it.id} className="flex flex-wrap items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-3 text-xs font-bold" dir="ltr">{i + 1}</span>
                    <span className="bidi font-semibold">{it.title}</span>
                    <span className={`chip ${QUADRANT_STYLE[it.quadrant]}`}>{t.cs.quadrants[it.quadrant]}</span>
                    <span className={moneyTone(it.netMonthly)} dir="ltr">{usd(it.netMonthly)}</span>
                    {it.id === o.recommended && <span className="chip bg-gold text-gold-ink">⭐ {t.cs.chosen}</span>}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {chosen && (
            <section className="card space-y-3 border-gold">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-gold">⭐ {t.cs.chosen}: <span className="bidi">{chosen.title}</span></h2>
                <form action={demoAction}>{hidden}<button className="btn-ghost text-sm" disabled={demoBusy}>{demoBusy ? `⏳ ${t.cs.working}` : `🧪 ${t.cs.buildDemo}`}</button></form>
              </div>
              {e.demo && e.demo.oppId === chosen.id && (
                <div className="space-y-2 text-sm">
                  <h3 className="font-semibold">{t.cs.demoTitle} <span className={`chip ${e.demo.works ? "bg-ok text-ink" : "bg-coral text-white"}`}>{e.demo.works ? "✓" : "✗"}</span></h3>
                  <pre className="overflow-x-auto rounded-lg bg-ink p-2 text-xs" dir="ltr">$ {e.demo.testCommand}{"\n"}{e.demo.testOutput}</pre>
                  <details><summary className="cursor-pointer text-muted">{e.demo.files.length} files</summary>
                    {e.demo.files.map((f: any) => <div key={f.path} className="mt-2"><p className="font-mono text-xs text-muted" dir="ltr">{f.path}</p><pre className="max-h-64 overflow-auto rounded-lg bg-ink p-2 text-xs" dir="ltr">{f.content}</pre></div>)}
                  </details>
                  {e.demo.limitations?.length > 0 && <p className="bidi text-muted">{e.demo.limitations.join(" · ")}</p>}
                  {e.review && (
                    <p className="bidi"><span className="text-muted">{t.cs.review}: </span><b>{e.review.verdict}</b> — {e.review.summary}
                      {e.review.issues?.length > 0 && <span className="text-coral"> · {e.review.issues.map((x: any) => `${x.issue} → ${x.fix}`).join(" · ")}</span>}</p>
                  )}
                </div>
              )}
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {o.items.map((it, i) => (
              <article key={it.id} className={`card space-y-3 ${it.id === o.recommended ? "border-gold" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-3 text-xs font-bold" dir="ltr">{i + 1}</span>
                  <h3 className="bidi font-bold">{it.title}</h3>
                  <span className={`chip ${QUADRANT_STYLE[it.quadrant]}`}>{t.cs.quadrants[it.quadrant]}</span>
                </div>
                <p className="bidi text-sm"><span className="text-muted">{t.cs.problem}: </span>{it.problem}</p>
                <p className="bidi text-sm"><span className="text-muted">{t.cs.approach}: </span>{it.solution}</p>
                <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-ink-3 p-2"><dt className="text-xs text-muted">{t.cs.saving}</dt><dd className="font-bold" dir="ltr">{usd(it.savingMonthly)}</dd></div>
                  <div className="rounded-lg bg-ink-3 p-2"><dt className="text-xs text-muted">{t.cs.net}</dt><dd className={`font-bold ${moneyTone(it.netMonthly)}`} dir="ltr">{usd(it.netMonthly)}</dd></div>
                  <div className="rounded-lg bg-ink-3 p-2"><dt className="text-xs text-muted">{t.cs.payback}</dt><dd className="font-bold">{it.paybackMonths == null ? t.cs.never : <><span dir="ltr">{it.paybackMonths}</span> {t.cs.months}</>}</dd></div>
                </dl>
                <p className="text-xs text-muted">{t.cs.value} <b dir="ltr">{it.value}</b> · {t.cs.ease} <b dir="ltr">{it.ease}</b> · {t.cs.speed} <b dir="ltr">{it.speed}</b></p>
                {it.redFlags.length > 0 && <p className="bidi text-sm text-coral">⚠️ {t.cs.redFlags}: {it.redFlags.join(" · ")}</p>}
                {it.risks.length > 0 && <p className="bidi text-xs text-muted">{t.cs.risks}: {it.risks.join(" · ")}</p>}
                {it.dataNeeded.length > 0 && <p className="bidi text-xs text-muted">{t.cs.dataNeeded}: {it.dataNeeded.join(" · ")}</p>}
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">{t.cs.inputs}</summary>
                  <form action={opportunityAction} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {hidden}
                    <input type="hidden" name="oppId" value={it.id} />
                    {(["tasksPerMonth", "minutesSaved", "hourlyCost", "runningMonthly", "setupCost"] as const).map((k) => {
                      const src = (it.inputSources as Record<string, string>)[k];
                      return (
                        <div key={k}>
                          <label className="label text-xs" htmlFor={`${it.id}-${k}`}>{k === "hourlyCost" ? t.cs.hourlyCost : t.cs[k]}</label>
                          <input id={`${it.id}-${k}`} name={k} dir="ltr" inputMode="decimal" className="input" defaultValue={it.inputs[k] ?? 0} />
                          {src && <p className={`mt-0.5 text-[11px] ${src === "assumption" ? "text-gold" : "text-muted"}`} dir="auto">{src === "assumption" ? t.cs.assumption : src}</p>}
                        </div>
                      );
                    })}
                    {(["value", "ease", "speed"] as const).map((k) => (
                      <div key={k}>
                        <label className="label text-xs" htmlFor={`${it.id}-${k}`}>{t.cs[k]} (1–5)</label>
                        <input id={`${it.id}-${k}`} name={k} type="number" min={1} max={5} step={0.5} dir="ltr" className="input" defaultValue={it[k]} />
                      </div>
                    ))}
                    <div className="col-span-full flex flex-wrap gap-2">
                      <button className="btn-ghost text-sm">↻ {t.cs.recalc}</button>
                      {it.id !== o.recommended && <button name="choose" value="1" className="btn-gold text-sm">⭐ {t.cs.choose}</button>}
                    </div>
                  </form>
                </details>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
