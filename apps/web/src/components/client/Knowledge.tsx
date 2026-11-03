import type { Client } from "@studio/db";
import { rebuildKnowledgeAction, saveKnowledgeAction } from "@/app/actions/clients";
import type { T } from "@/lib/i18n";

export function ClientKnowledge({ c, t }: { c: Client; t: T }) {
  const kb = c.knowledge;
  const hidden = <input type="hidden" name="clientId" value={c.id} />;
  return (
    <div className="space-y-4">
      {!kb && <p className="card text-sm text-muted">{t.cl.kbBuilding}</p>}
      {kb?.unknowns?.length > 0 && (
        <section className="card border-gold">
          <h2 className="font-bold text-gold">❓ {t.cl.unknowns}</h2>
          <ul className="bidi mt-2 list-disc space-y-0.5 ps-5 text-sm">{kb.unknowns.map((u: string) => <li key={u}>{u}</li>)}</ul>
        </section>
      )}
      <form action={rebuildKnowledgeAction} className="card space-y-2">
        {hidden}
        <label className="label" htmlFor="notes">{t.cl.notes}</label>
        <textarea id="notes" name="notes" rows={5} dir="auto" className="input" defaultValue={c.notes} />
        <button className="btn-gold">↻ {t.cl.rebuild}</button>
      </form>
      {kb && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-2 text-sm">
            <h2 className="font-bold text-gold">{t.cl.services}</h2>
            <ul className="space-y-1">{kb.services.map((s: any) => <li key={s.name} className="bidi flex justify-between gap-3"><span>{s.name}{s.duration && <span className="text-muted"> · {s.duration}</span>}</span><b dir="auto">{s.price || "—"}</b></li>)}</ul>
            <h2 className="pt-2 font-bold text-gold">{t.cl.hours}</h2>
            <ul>{kb.hours.map((h: any) => <li key={h.days} className="bidi">{h.days}: <span dir="ltr">{h.open}–{h.close}</span></li>)}</ul>
            <p className="bidi text-muted">📍 {[kb.location?.address, kb.location?.area].filter(Boolean).join(" · ")}</p>
          </section>
          <section className="card space-y-2 text-sm">
            <h2 className="font-bold text-gold">{t.cl.faqs}</h2>
            <dl className="space-y-1.5">{kb.faqs.map((f: any) => <div key={f.q} className="bidi"><dt className="font-semibold">{f.q}</dt><dd className="text-muted">{f.a}</dd></div>)}</dl>
            {kb.policies?.length > 0 && <p className="bidi"><span className="text-muted">{t.cl.policies}: </span>{kb.policies.join(" · ")}</p>}
            {kb.doNotAnswer?.length > 0 && <p className="bidi text-coral">{t.cl.doNotAnswer}: {kb.doNotAnswer.join("، ")}</p>}
          </section>
        </div>
      )}
      {kb && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-bold">{t.cl.editJson}</summary>
          <form action={saveKnowledgeAction} className="mt-3 space-y-2">
            {hidden}
            <textarea name="json" rows={18} dir="ltr" className="input font-mono text-xs" defaultValue={JSON.stringify(kb, null, 2)} />
            <button className="btn-ghost">{t.cl.saveKb}</button>
          </form>
        </details>
      )}
    </div>
  );
}
