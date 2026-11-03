import { latestStrategy } from "@studio/core";
import { runStrategy } from "@/app/actions/studio";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const AVAIL_STYLE: Record<string, string> = { yes: "bg-ok text-ink", no: "bg-coral text-white", partial: "bg-gold text-gold-ink", unknown: "bg-ink-3 text-muted" };

export default async function StrategyPage() {
  const [{ workspace, brand }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const s = await latestStrategy(workspace.id);
  const plan = s?.plan;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t.strategyTitle}</h1>
          <p className="text-sm text-muted" dir="ltr">{brand.country} · {brand.platforms.join(" · ")}{s ? ` · ${s.createdAt.toLocaleDateString(locale === "ar" ? "ar-LB" : "en-GB")}` : ""}</p>
        </div>
        <form action={runStrategy}><button className="btn-gold">{t.runStrategy}</button></form>
      </div>
      {!plan && <p className="card text-muted">{t.noStrategy}</p>}
      {plan && (
        <>
          <section className="card">
            <p className="bidi text-lg">{plan.summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gold/50 bg-ink p-3">
                <h2 className="text-sm font-bold text-gold">{t.weeklyFocus}</h2>
                <p className="bidi mt-1 font-semibold">{plan.weeklyFocus}</p>
              </div>
              <div className="rounded-xl border border-line bg-ink p-3">
                <h2 className="text-sm font-bold text-gold">{t.presenterPolicy}</h2>
                <p className="bidi mt-1">{plan.presenterPolicy}</p>
              </div>
            </div>
          </section>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plan.platforms.map((p: any) => (
              <section key={p.platform} className="card space-y-2 text-sm">
                <header className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold capitalize" dir="ltr">{p.platform}</h2>
                  <span className={`chip ${AVAIL_STYLE[p.availableInCountry] ?? AVAIL_STYLE.unknown}`}>{t.available[p.availableInCountry as keyof T_Avail] ?? p.availableInCountry}</span>
                </header>
                <p className="bidi text-muted">{p.role}</p>
                <p className="bidi"><b>{t.monetization}:</b> {p.monetizationPath}</p>
                <p className="bidi"><b>{t.nextMilestone}:</b> {p.nextMilestone}</p>
                <div>
                  <b>{t.actions}:</b>
                  <ul className="bidi mt-1 list-disc space-y-0.5 ps-5">{p.actions.map((a: string) => <li key={a}>{a}</li>)}</ul>
                </div>
              </section>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card text-sm">
              <h2 className="mb-2 font-display text-lg font-bold text-gold">{t.revenueStreams}</h2>
              <ol className="space-y-2">
                {plan.revenueStreams.map((r: any, i: number) => (
                  <li key={i} className="bidi"><b>{i + 1}. {r.name}</b> — {r.how} <span className="text-muted">({r.when})</span></li>
                ))}
              </ol>
            </section>
            {plan.risks?.length > 0 && (
              <section className="card text-sm">
                <h2 className="mb-2 font-display text-lg font-bold text-gold">{t.risks}</h2>
                <ul className="bidi list-disc space-y-1 ps-5">{plan.risks.map((r: string) => <li key={r}>{r}</li>)}</ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type T_Avail = { yes: string; no: string; partial: string; unknown: string };
