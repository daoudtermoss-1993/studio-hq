import type { Problem } from "@studio/db";
import { CopyButton } from "@/components/CopyButton";
import type { T } from "@/lib/i18n";

const SEV: Record<string, string> = { critical: "bg-coral text-white", high: "bg-coral/70 text-white", medium: "bg-gold text-gold-ink", low: "bg-ink-3 text-muted" };
const tone = (n: number) => (n < 50 ? "text-coral" : n < 80 ? "text-gold" : "text-ok");
const bar = (n: number) => (n < 50 ? "bg-coral" : n < 80 ? "bg-gold" : "bg-ok");
const sec = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

/** Audit → before/after → design + backend → offer, for one business (problems.kind = "opportunity"). */
export function OpportunityView({ p, t }: { p: Problem; t: T }) {
  const a = p.audit, d = p.design, o = p.offer, pr = a?.presence;
  const psi = a?.facts?.psi;
  const metrics: [string, string, boolean | null][] = psi
    ? [
        ["LCP", sec(psi.field?.lcpMs ?? psi.lcpMs), (psi.field?.lcpMs ?? psi.lcpMs) == null ? null : (psi.field?.lcpMs ?? psi.lcpMs) <= 2500],
        ["FCP", sec(psi.fcpMs), psi.fcpMs == null ? null : psi.fcpMs <= 1800],
        ["TBT", psi.tbtMs == null ? "—" : `${Math.round(psi.tbtMs)}ms`, psi.tbtMs == null ? null : psi.tbtMs <= 200],
        ["CLS", psi.cls == null ? "—" : psi.cls.toFixed(2), psi.cls == null ? null : psi.cls <= 0.1],
        ["Weight", psi.totalBytes == null ? "—" : `${(psi.totalBytes / 1_048_576).toFixed(1)} MB`, psi.totalBytes == null ? null : psi.totalBytes <= 1_600_000],
        ["TTFB", a.facts.ttfbMs == null ? "—" : `${a.facts.ttfbMs}ms`, a.facts.ttfbMs == null ? null : a.facts.ttfbMs <= 800],
      ]
    : [];
  const previewSrc = p.previewToken ? `/p/${p.previewToken}` : null;

  return (
    <>
      {a && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-gold">{t.auditTitle}</h2>
            <span className="text-xs text-muted">{t.measuredBy}{a.facts?.measuredAt && ` · ${a.facts.measuredAt.slice(0, 10)}`}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="rounded-xl border border-line p-4 text-center">
              <div className="label">{t.siteScore}</div>
              <div className={`font-display text-5xl font-extrabold ${tone(a.score.score)}`} dir="ltr">{p.website ? a.score.score : "—"}</div>
              <div className="text-xs text-muted" dir="ltr">/ 100</div>
            </div>
            <div className="space-y-2">
              <p className="bidi text-lg font-bold">{a.report.headline}</p>
              <p className="bidi text-sm text-muted">{a.report.summary}</p>
              {p.website && (
                <div className="grid gap-2 sm:grid-cols-5">
                  {(Object.keys(t.areas) as (keyof typeof t.areas)[]).map((k) => (
                    <div key={k} className="text-xs">
                      <div className="flex justify-between"><span>{t.areas[k]}</span><b dir="ltr">{a.score.areas[k]}</b></div>
                      <div className="mt-1 h-1.5 rounded bg-ink-3"><div className={`h-1.5 rounded ${bar(a.score.areas[k])}`} style={{ width: `${a.score.areas[k]}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {metrics.map(([k, v, good]) => (
                <div key={k} className="rounded-lg border border-line p-2 text-center">
                  <div className="text-xs text-muted" dir="ltr">{k}</div>
                  <div className={`font-bold ${good == null ? "" : good ? "text-ok" : "text-coral"}`} dir="ltr">{v}</div>
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1.5 text-sm">
            {a.score.findings.map((f: { id: string; severity: string; evidence: string }) => {
              const explained = a.report.topIssues.find((i: { findingId: string }) => i.findingId === f.id);
              return (
                <li key={f.id} className="bidi flex flex-wrap items-baseline gap-2">
                  <span className={`chip ${SEV[f.severity]}`}>{t.sev[f.severity as keyof typeof t.sev]}</span>
                  <b>{t.finding[f.id as keyof typeof t.finding] ?? f.id}</b>
                  <span className="text-xs text-muted" dir="ltr">{f.evidence}</span>
                  {explained && <span className="w-full ps-2 text-muted">→ {explained.impact}</span>}
                </li>
              );
            })}
          </ul>
          {a.report.quickWins?.length > 0 && <p className="bidi text-sm"><span className="text-muted">Quick wins: </span>{a.report.quickWins.join(" · ")}</p>}
        </section>
      )}

      {pr && (
        <section className="card space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gold">{t.presenceTitle}</h2>
            <span className="chip bg-ink-3 text-text">{t.primaryChannel}: <span dir="auto">{pr.primaryChannel}</span></span>
          </div>
          {pr.profiles.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {pr.profiles.map((x: { platform: string; url: string; kind: string; does: string; active: string }) => (
                <li key={x.platform + x.url} className="flex items-start gap-3 rounded-lg border border-line p-3">
                  <span className="chip bg-sky text-ink">{t.pkind[x.kind as keyof typeof t.pkind] ?? x.kind}</span>
                  <div className="min-w-0">
                    {x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline" dir="auto">{x.platform}</a> : <b dir="auto">{x.platform}</b>}
                    <p className="bidi text-muted">{x.does}{x.active === "no" ? " · ✕" : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {a.facts?.html?.platforms?.length > 0 && <p className="text-xs text-muted">{t.linkedFromSite}: <span dir="ltr">{a.facts.html.platforms.join(", ")}</span></p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="label">{t.alreadyCovered}</div><ul className="bidi list-disc space-y-0.5 ps-5">{pr.alreadyCovered.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
            <div><div className="label">{t.gapsLabel}</div><ul className="bidi list-disc space-y-0.5 ps-5">{pr.gaps.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
          </div>
          <p className="bidi rounded-lg bg-ink px-3 py-2"><span className="text-muted">{t.positioningLabel}: </span>{pr.positioning}</p>
        </section>
      )}

      {d && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gold">{t.before} ← → {t.after}</h2>
            {previewSrc && <a href={previewSrc} target="_blank" rel="noreferrer" className="btn-gold px-3 py-1.5 text-xs">{t.openPreview} ↗</a>}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
            <div className="space-y-2">
              <div className="label">{t.before}</div>
              {psi?.screenshot
                ? <img src={psi.screenshot} alt={t.before} className="max-h-[700px] rounded-xl border border-line" />
                : <div className="grid h-40 place-items-center rounded-xl border border-dashed border-line text-sm text-muted">{p.website ? t.noScreenshot : t.noWebsite}</div>}
            </div>
            {previewSrc && (
              <div className="space-y-2">
                <div className="label">{t.after} · 390px</div>
                <iframe title={t.after} src={previewSrc} sandbox="" className="h-[720px] w-full max-w-[390px] rounded-[28px] border-[6px] border-ink-3 bg-white" />
              </div>
            )}
          </div>
          {previewSrc && o?.previewUrl && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">{t.previewLink}:</span>
              <code className="break-all rounded bg-ink px-2 py-1 text-xs" dir="ltr">{o.previewUrl}</code>
              <CopyButton text={o.previewUrl} label={t.copy} done={t.copied} />
            </div>
          )}
        </section>
      )}

      {d && (
        <section className="card space-y-4 text-sm">
          <h2 className="font-bold text-gold">{t.designTitle}</h2>
          <p className="bidi"><span className="text-muted">{t.concept}: </span>{d.concept}</p>
          <div className="flex flex-wrap gap-3">
            {d.palette.map((c: { name: string; hex: string; use: string }) => (
              <div key={c.hex + c.name} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5">
                <span className="h-6 w-6 rounded" style={{ background: c.hex }} />
                <span className="text-xs"><b dir="ltr">{c.hex}</b> · {c.use}</span>
              </div>
            ))}
          </div>
          <p className="bidi"><span className="text-muted">{t.typography}: </span><span dir="ltr">{d.typography.heading} / {d.typography.body}</span></p>
          <p className="bidi"><span className="text-muted">{t.sitemap}: </span>{d.sitemap.join(" · ")}</p>
          <h3 className="pt-2 font-bold text-gold">{t.backendTitle}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="label">{t.architecture}</div><ul className="bidi list-disc space-y-0.5 ps-5">{d.backend.architecture.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
            <div className="space-y-2">
              {([["dataModel", t.dataModel], ["integrations", t.integrations], ["performanceBudget", t.perfBudget], ["seo", t.seoPlan], ["security", t.securityPlan]] as const).map(([k, label]) =>
                d.backend[k]?.length ? <p key={k} className="bidi"><span className="text-muted">{label}: </span>{d.backend[k].join(" · ")}</p> : null)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.backend.stack.map((x: string) => <span key={x} className="chip bg-ink-3 text-muted" dir="ltr">{x}</span>)}
            <span className="chip bg-ink-3 text-text">{t.hosting}: <span dir="auto">{d.backend.hosting}</span></span>
            <span className="chip bg-ink-3 text-text">{t.runningCost}: <span dir="auto">{d.backend.monthlyCost}</span></span>
          </div>
          <div>
            <div className="label">{t.buildPlan}</div>
            <ol className="bidi list-decimal space-y-0.5 ps-5">{d.buildPlan.map((b: { phase: string; days: number; deliverable: string }) => <li key={b.phase}>{b.phase} — <span dir="ltr">{b.days}</span> {t.days} → <span className="text-muted">{b.deliverable}</span></li>)}</ol>
          </div>
          {d.placeholders?.length > 0 && <p className="bidi text-gold">{t.placeholdersLabel}: {d.placeholders.join("، ")}</p>}
          {d.gate?.length > 0 && <p className="bidi text-xs text-coral">{t.gateFailed}: {d.gate.join(" · ")}</p>}
        </section>
      )}

      {o && (
        <section className="card flex flex-wrap items-center gap-4">
          <div className="min-w-56 flex-1">
            <h2 className="font-bold text-gold">{t.offerTitle}</h2>
            <p className="bidi text-lg font-bold">{o.name}</p>
            <p className="bidi text-sm text-muted">{o.includes}</p>
            {o.alsoSuggest?.length > 0 && <p className="text-xs text-muted">{t.alsoSuggest}: <span dir="ltr">{o.alsoSuggest.join(", ")}</span></p>}
          </div>
          <div className="text-center"><div className="label">{t.priceLabel}</div><div className="font-display text-2xl font-extrabold text-gold" dir="auto">{o.price}</div></div>
          {o.timelineDays > 0 && <div className="text-center"><div className="label">{t.timeline}</div><div className="text-xl font-bold"><span dir="ltr">{o.timelineDays}</span> {t.days}</div></div>}
        </section>
      )}
    </>
  );
}
