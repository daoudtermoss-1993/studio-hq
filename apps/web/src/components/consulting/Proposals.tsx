import { brandOf, chosenOpportunity, priceOf, proposalText } from "@studio/core";
import type { Engagement } from "@studio/db";
import { pricesAction, proposalAction } from "@/app/actions/consulting";
import { CopyButton } from "@/components/CopyButton";
import type { T } from "@/lib/i18n";

function One({ p, language, t }: { p: any; language: string; t: T }) {
  return (
    <article className="card space-y-3" dir="auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="bidi text-lg font-bold">{p.title}</h3>
        <div className="flex gap-2">
          <CopyButton text={proposalText(p, language)} label={t.cs.copyAll} done={t.copied} />
          <CopyButton text={`${p.coverEmail.subject}\n\n${p.coverEmail.body}`} label={t.cs.copyEmail} done={t.copied} />
        </div>
      </div>
      <p className="bidi"><span className="text-muted">{t.cs.problem}: </span>{p.problemInTheirWords}</p>
      <p className="bidi"><span className="text-muted">{t.cs.approach}: </span>{p.approach}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div><h4 className="font-semibold">{t.cs.deliverables}</h4><ul className="bidi list-disc ps-5 text-sm">{p.deliverables.map((d: string) => <li key={d}>{d}</li>)}</ul></div>
        <div><h4 className="font-semibold">{t.cs.timelineL}</h4><ul className="bidi text-sm">{p.timeline.map((x: any) => <li key={x.when}><b>{x.when}</b>: {x.what}</li>)}</ul></div>
      </div>
      <div className="flex flex-wrap items-start gap-4 rounded-lg bg-ink-3 p-3">
        <p className="text-lg font-extrabold text-gold">{t.cs.price}: <span dir="ltr">{p.price}</span></p>
        <div className="text-sm"><span className="text-muted">{t.cs.terms}:</span><ul className="bidi">{p.terms.map((x: string) => <li key={x}>• {x}</li>)}</ul></div>
      </div>
      <div className="grid gap-4 text-sm md:grid-cols-3">
        {p.weNeed?.length > 0 && <div><h4 className="font-semibold">{t.cs.weNeed}</h4><ul className="bidi list-disc ps-5">{p.weNeed.map((d: string) => <li key={d}>{d}</li>)}</ul></div>}
        {p.outOfScope?.length > 0 && <div><h4 className="font-semibold">{t.cs.outOfScope}</h4><ul className="bidi list-disc ps-5">{p.outOfScope.map((d: string) => <li key={d}>{d}</li>)}</ul></div>}
        <div><h4 className="font-semibold">{t.cs.success}</h4><p className="bidi">{p.successMeasure}</p></div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">✉️ {t.cs.coverEmail}</summary>
        <p className="bidi mt-2 font-semibold">{p.coverEmail.subject}</p>
        <p className="bidi whitespace-pre-wrap text-muted">{p.coverEmail.body}</p>
      </details>
    </article>
  );
}

export async function ConsultProposals({ e, t, busy }: { e: Engagement; t: T; busy: boolean }) {
  const brand = await brandOf(e.workspaceId);
  const hidden = <input type="hidden" name="engagementId" value={e.id} />;
  const hasPilot = Boolean(chosenOpportunity(e));
  return (
    <div className="space-y-4">
      <form action={pricesAction} className="card flex flex-wrap items-end gap-3">
        {hidden}
        <h2 className="w-full font-bold text-gold">💵 {t.cs.prices}</h2>
        {(["assessment", "pilot", "retainer"] as const).map((k) => (
          <div key={k} className="min-w-36 flex-1">
            <label className="label" htmlFor={`price-${k}`}>{t.cs[k]}</label>
            <input id={`price-${k}`} name={k} dir="ltr" className="input" defaultValue={e.prices?.[k] ?? ""} placeholder={priceOf(brand, e, k)} />
          </div>
        ))}
        <button className="btn-ghost">{t.cs.savePrices}</button>
      </form>

      <div className="card flex flex-wrap items-center gap-3">
        <form action={proposalAction}>{hidden}<input type="hidden" name="kind" value="assessment" /><button className="btn-gold" disabled={busy}>📝 {t.cs.writeAssessment}</button></form>
        <form action={proposalAction}>{hidden}<input type="hidden" name="kind" value="pilot" /><button className="btn-ghost" disabled={busy || !hasPilot}>📝 {t.cs.writePilot}</button></form>
        {!hasPilot && <span className="text-sm text-muted">{t.cs.needsPilot}</span>}
        {busy && <span className="chip bg-gold text-gold-ink">⏳ {t.cs.working}</span>}
      </div>

      {!e.proposal && !e.pilotProposal && <p className="card text-sm text-muted">{t.cs.noProposal}</p>}
      {e.proposal && <One p={e.proposal} language={e.language} t={t} />}
      {e.pilotProposal && <One p={e.pilotProposal} language={e.language} t={t} />}
    </div>
  );
}
