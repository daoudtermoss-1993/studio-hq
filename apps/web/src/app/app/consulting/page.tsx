import Link from "next/link";
import { chosenOpportunity, consultingSummary, MARKETS, recentEngagements, SOURCES } from "@studio/core";
import type { Engagement } from "@studio/db";
import { createEngagementAction } from "@/app/actions/consulting";
import { moneyTone, STAGE_STYLE, usd } from "@/components/consulting/style";
import { currentWorkspace } from "@/lib/auth";
import { getT, type T } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COLUMNS = [["lead"], ["proposal"], ["assessment", "pilot"], ["retainer"]] as const;

function Card({ e, t }: { e: Engagement; t: T }) {
  const opp = chosenOpportunity(e);
  return (
    <Link href={`/app/consulting/${e.id}`} className="card block space-y-2 transition hover:border-gold">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${STAGE_STYLE[e.stage]}`}>{t.cs.stages[e.stage]}</span>
        <span className="chip bg-ink-3 text-muted">{t.cs.markets[e.market as keyof typeof t.cs.markets] ?? e.market}</span>
        {e.value != null && <span className="chip bg-ok text-ink" dir="ltr">${e.value.toLocaleString("en")}</span>}
      </div>
      <p className="bidi text-lg font-bold">{e.company}</p>
      <p className="text-sm text-muted" dir="auto">{[e.sector, e.country, e.size && `${e.size} 👥`].filter(Boolean).join(" · ")}</p>
      {opp && <p className="bidi text-sm">🎯 {opp.title} · <span className={moneyTone(opp.netMonthly)} dir="ltr">{usd(opp.netMonthly)}</span> {t.cs.net}</p>}
    </Link>
  );
}

export default async function ConsultingPage() {
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const [all, sum] = await Promise.all([recentEngagements(workspace.id, 200), consultingSummary(workspace.id)]);
  const done = all.filter((e) => e.stage === "closed" || e.stage === "lost");

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t.cs.title}</h1>
          <p className="max-w-3xl text-sm text-muted">{t.cs.sub}</p>
        </div>
        <span className="chip bg-ok text-ink">{t.cs.won}: <b dir="ltr">${sum.won.toLocaleString("en")}</b></span>
      </div>

      <details className="card" open={all.length === 0}>
        <summary className="cursor-pointer font-bold">＋ {t.cs.newEngagement}</summary>
        <form action={createEngagementAction} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="label" htmlFor="company">{t.cs.company}</label><input id="company" name="company" required dir="auto" className="input" /></div>
          <div><label className="label" htmlFor="website">{t.cs.website}</label><input id="website" name="website" dir="ltr" className="input" placeholder="company.com" /></div>
          <div><label className="label" htmlFor="sector">{t.cs.sector}</label><input id="sector" name="sector" dir="auto" className="input" placeholder="ISP" /></div>
          <div><label className="label" htmlFor="country">{t.cs.country}</label><input id="country" name="country" dir="auto" className="input" /></div>
          <div><label className="label" htmlFor="size">{t.cs.size}</label><input id="size" name="size" dir="auto" className="input" placeholder="30–500" /></div>
          <div><label className="label" htmlFor="contactRole">{t.cs.contactRole}</label><input id="contactRole" name="contactRole" dir="auto" className="input" placeholder="COO" /></div>
          <div><label className="label" htmlFor="contactName">{t.cs.contactName}</label><input id="contactName" name="contactName" dir="auto" className="input" /></div>
          <div>
            <label className="label" htmlFor="source">{t.cs.source}</label>
            <select id="source" name="source" className="input">{SOURCES.map((s) => <option key={s} value={s}>{t.cs.sources[s]}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="market">{t.cs.market}</label>
            <select id="market" name="market" className="input">{MARKETS.map((m) => <option key={m} value={m}>{t.cs.markets[m]}</option>)}</select>
          </div>
          <div><label className="label" htmlFor="language">{t.cs.language}</label><input id="language" name="language" dir="ltr" className="input" defaultValue="Lebanese Arabic" /></div>
          <div className="sm:col-span-2 lg:col-span-3"><label className="label" htmlFor="notes">{t.cs.notes}</label><textarea id="notes" name="notes" rows={4} dir="auto" className="input" /></div>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-3">🔒 {t.cs.privacyNote}</p>
          <div><button className="btn-gold">{t.cs.create}</button></div>
        </form>
      </details>

      {all.length === 0 && <p className="card text-muted">{t.cs.empty}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = all.filter((e) => (col as readonly string[]).includes(e.stage));
          return (
            <section key={col.join()} className="space-y-3">
              <h2 className="flex items-center justify-between font-bold text-gold">
                <span>{col.map((s) => t.cs.stages[s]).join(" · ")}</span><span className="chip bg-ink-3 text-muted">{items.length}</span>
              </h2>
              {items.map((e) => <Card key={e.id} e={e} t={t} />)}
            </section>
          );
        })}
      </div>
      {done.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-muted">{t.cs.stages.closed} / {t.cs.stages.lost} ({done.length})</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">{done.map((e) => <Card key={e.id} e={e} t={t} />)}</div>
        </details>
      )}
    </div>
  );
}
