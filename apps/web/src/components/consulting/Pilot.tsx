import { chosenOpportunity, pilotResults, type PilotMetric } from "@studio/core";
import type { Engagement } from "@studio/db";
import { metricsAction, pilotReportAction, planPilotAction } from "@/app/actions/consulting";
import { CopyButton } from "@/components/CopyButton";
import type { T } from "@/lib/i18n";
import { moneyTone, usd } from "./style";

export function ConsultPilot({ e, t, busy }: { e: Engagement; t: T; busy: boolean }) {
  const opp = chosenOpportunity(e);
  const hidden = <input type="hidden" name="engagementId" value={e.id} />;
  const plan = e.pilot?.plan;
  const res = e.pilot ? pilotResults(e.pilot.metrics as PilotMetric[], opp) : null;
  const rep = e.pilotReport;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        {opp ? <p className="bidi font-semibold">⭐ {opp.title} · <span className={moneyTone(opp.netMonthly)} dir="ltr">{usd(opp.netMonthly)}</span> {t.cs.net}</p> : <p className="text-sm text-muted">{t.cs.needsPilot}</p>}
        <form action={planPilotAction}>{hidden}<button className="btn-gold" disabled={busy || !opp}>🗓️ {t.cs.planPilot}</button></form>
        {busy && <span className="chip bg-gold text-gold-ink">⏳ {t.cs.working}</span>}
      </div>
      {!plan && <p className="card text-sm text-muted">{t.cs.noPlan}</p>}
      {plan && res && (
        <>
          <section className="card space-y-3">
            <h2 className="font-bold text-gold">📏 {t.cs.metricsTitle}</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-ink-3 p-3 text-center"><p className="text-xs text-muted">{t.cs.realized}</p><p className="text-xl font-extrabold text-ok" dir="ltr">{res.realizedMonthly == null ? "—" : usd(res.realizedMonthly)}</p></div>
              <div className="rounded-lg bg-ink-3 p-3 text-center"><p className="text-xs text-muted">{t.cs.promised}</p><p className="text-xl font-extrabold" dir="ltr">{usd(res.promisedMonthly)}</p></div>
              <div className="rounded-lg bg-ink-3 p-3 text-center"><p className="text-xs text-muted">&nbsp;</p><p className={`text-lg font-bold ${res.hitTarget ? "text-ok" : "text-muted"}`}>{res.hitTarget == null ? t.cs.notMeasured : res.hitTarget ? `✓ ${t.cs.hit}` : t.cs.notYet}</p></div>
            </div>
            <form action={metricsAction} className="space-y-3">
              {hidden}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted"><tr><th className="py-1 text-start">{t.cs.metric}</th><th className="text-start">{t.cs.baseline}</th><th className="text-start">{t.cs.current}</th><th className="text-start">{t.cs.change}</th></tr></thead>
                  <tbody>
                    {res.metrics.map((m) => (
                      <tr key={m.key} className="border-t border-line align-top">
                        <td className="bidi py-2 pe-3"><b>{m.name}</b> <span className="text-muted">({m.unit})</span><div className="text-xs text-muted">{t.cs.howToMeasure}: {m.howToMeasure}</div></td>
                        <td className="pe-2"><input aria-label={`${m.name} ${t.cs.baseline}`} name={`b_${m.key}`} dir="ltr" inputMode="decimal" className="input w-24" defaultValue={m.baseline ?? ""} /></td>
                        <td className="pe-2"><input aria-label={`${m.name} ${t.cs.current}`} name={`c_${m.key}`} dir="ltr" inputMode="decimal" className="input w-24" defaultValue={m.current ?? ""} /></td>
                        <td className={`py-2 font-bold ${m.improved == null ? "text-muted" : m.improved ? "text-ok" : "text-coral"}`} dir="ltr">{m.changePct == null ? "—" : `${m.changePct > 0 ? "+" : ""}${m.changePct}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost">{t.cs.saveMetrics}</button>
              </div>
            </form>
            <form action={pilotReportAction}>{hidden}<button className="btn-gold" disabled={busy}>📊 {t.cs.writeReport}</button></form>
          </section>

          {rep && (
            <section className="card space-y-2 border-gold">
              <h2 className="font-bold text-gold">{t.cs.reportTitle}</h2>
              <p className="bidi text-lg font-bold">{rep.headline}</p>
              {rep.wins?.length > 0 && <ul className="bidi list-disc ps-5 text-sm text-ok">{rep.wins.map((w: string) => <li key={w}>{w}</li>)}</ul>}
              {rep.issues?.length > 0 && <ul className="bidi list-disc ps-5 text-sm text-coral">{rep.issues.map((w: string) => <li key={w}>{w}</li>)}</ul>}
              <p className="bidi text-sm"><span className="text-muted">→ </span>{rep.next}</p>
              <div className="rounded-lg bg-ink-3 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2"><span className="text-muted">{t.cs.clientMessage}</span><CopyButton text={rep.clientMessage} label={t.copy} done={t.copied} /></div>
                <p className="bidi whitespace-pre-wrap">{rep.clientMessage}</p>
              </div>
            </section>
          )}

          <section className="card grid gap-4 text-sm md:grid-cols-2">
            <div>
              <h2 className="font-bold text-gold">{t.cs.weeks}</h2>
              <ol className="mt-1 space-y-2">{plan.weeks.map((w: any) => <li key={w.week} className="bidi"><b>{w.week}</b> — {w.goal}<ul className="list-disc ps-5 text-muted">{w.tasks.map((x: string) => <li key={x}>{x}</li>)}</ul></li>)}</ol>
            </div>
            <div className="space-y-2">
              {plan.dataAccess?.length > 0 && <p className="bidi"><span className="text-muted">{t.cs.dataAccess}: </span>{plan.dataAccess.join(" · ")}</p>}
              <p className="bidi"><span className="text-muted">{t.cs.humanInLoop}: </span>{plan.humanInLoop}</p>
              <p className="bidi"><span className="text-muted">{t.cs.rollback}: </span>{plan.rollback}</p>
              {plan.risks?.length > 0 && <p className="bidi text-coral">⚠️ {plan.risks.join(" · ")}</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
