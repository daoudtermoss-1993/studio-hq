import type { Client } from "@studio/db";
import { latestArtifact } from "@studio/core";
import { clientJobAction } from "@/app/actions/clients";
import type { T } from "@/lib/i18n";

export async function ClientReport({ c, t }: { c: Client; t: T }) {
  const rep = await latestArtifact(c.id, "report");
  const d = rep?.data;
  return (
    <div className="space-y-4">
      <form action={clientJobAction}>
        <input type="hidden" name="clientId" value={c.id} /><input type="hidden" name="job" value="client-report" /><input type="hidden" name="tab" value="report" />
        <button className="btn-gold">📊 {t.cl.makeReport}</button>
      </form>
      {!d ? <p className="card text-muted">{t.cl.noReport}</p> : (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="bidi font-display text-xl font-extrabold">{d.headline}</h2>
            <span className="text-sm text-muted" dir="ltr">{rep.period}</span>
          </div>
          <p className="bidi text-sm">{d.summary}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(t.cl.metrics) as (keyof typeof t.cl.metrics)[]).map((k) => (
              <div key={k} className="rounded-lg border border-line p-3 text-center">
                <div className="font-display text-2xl font-extrabold" dir="ltr">{d.metrics[k] ?? "—"}</div>
                <div className="text-xs text-muted">{t.cl.metrics[k]}</div>
              </div>
            ))}
            <div className="rounded-lg border border-line p-3 text-center">
              <div className="font-display text-2xl font-extrabold" dir="ltr">{d.metrics.bookings.requested} / {d.metrics.bookings.done}</div>
              <div className="text-xs text-muted">{t.cl.bookingsLabel}</div>
            </div>
            {d.metrics.evaluation && <div className="rounded-lg border border-line p-3 text-center"><div className="font-display text-2xl font-extrabold text-ok" dir="ltr">{d.metrics.evaluation}</div><div className="text-xs text-muted">{t.cl.evalScore}</div></div>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            {([["wins", t.cl.wins], ["issues", t.cl.issues], ["next", t.cl.next]] as const).map(([k, label]) => (
              <div key={k}><div className="label">{label}</div><ul className="bidi list-disc ps-5">{(d[k] ?? []).map((x: string) => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
