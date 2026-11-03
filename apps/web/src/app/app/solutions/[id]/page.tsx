import Link from "next/link";
import { notFound } from "next/navigation";
import { engineerName } from "@studio/core";
import { and, db, eq, problems, reels } from "@studio/db";
import { dealAction, reelFromProblemAction, rerunProblem } from "@/app/actions/studio";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const SEV: Record<string, string> = { critical: "bg-coral text-white", high: "bg-coral/70 text-white", medium: "bg-gold text-gold-ink", low: "bg-ink-3 text-muted" };

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const [p] = await db.select().from(problems).where(and(eq(problems.id, id), eq(problems.workspaceId, workspace.id)));
  if (!p) notFound();
  const [reel] = p.reelId ? await db.select({ number: reels.number }).from(reels).where(eq(reels.id, p.reelId)) : [];
  const q = p.qualification, s = p.solution, d = p.demo, r = p.review, o = p.outreach;
  const busy = p.status === "new" || p.status === "solving" || (p.status === "qualified" && !s);
  const hidden = <input type="hidden" name="problemId" value={p.id} />;
  const dealStage = ["solved", "contacted", "replied", "won", "lost"].includes(p.status);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {busy && <AutoRefresh every={5000} />}
      <Link href="/app/solutions" className="text-sm text-muted hover:underline">← {t.solutionsTitle}</Link>
      <header className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-gold text-gold-ink">{t.pstatus[p.status]}</span>
          <span className="chip bg-ink-3 text-muted">{t.track[p.track as "smb" | "technical"] ?? p.track}</span>
          <span className="chip bg-ink-3 text-muted" dir="ltr">{p.source}</span>
          {p.votes != null && <span className="chip bg-ink-3 text-muted" dir="ltr">▲ {p.votes}</span>}
          <a href={p.url} target="_blank" rel="noreferrer" className="text-sm text-sky hover:underline">{t.openSource} ↗</a>
        </div>
        <h1 className="bidi font-display text-xl font-extrabold">{p.title}</h1>
        <p className="text-sm text-muted" dir="auto">{p.author}{p.organization && ` · ${p.organization}`}</p>
        <p className="bidi whitespace-pre-wrap text-sm">{p.body}</p>
      </header>

      {q && (
        <section className="card space-y-3">
          <h2 className="font-bold text-gold">{t.qualification}</h2>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div><div className="label">{t.fit}</div><b dir="ltr">{q.fitScore}/10</b></div>
            <div><div className="label">{t.assignee}</div><b>👷 {engineerName(q.assignee, locale)}</b></div>
            <div><div className="label">{t.effort}</div><b dir="ltr">{q.effortDays?.best}–{q.effortDays?.worst} ({q.effortDays?.likely})</b></div>
            <div><div className="label">{t.priceLabel}</div><b dir="auto">{q.price?.setup}{q.price?.monthly && ` + ${q.price.monthly}`}</b></div>
          </div>
          <p className="bidi text-sm"><span className="text-muted">{t.valueLabel}: </span>{q.valueEstimate}</p>
          <p className="bidi text-sm text-muted">{q.why}</p>
          {q.rejectReason && p.status === "rejected" && <p className="bidi text-sm text-coral">{t.whyRejected}: {q.rejectReason}</p>}
          {q.questions?.length > 0 && (
            <div className="text-sm"><div className="label">{t.questionsForThem}</div><ul className="bidi list-disc ps-5">{q.questions.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
          )}
        </section>
      )}

      {s && (
        <section className="card space-y-3 text-sm">
          <h2 className="font-bold text-gold">{t.solutionTitle}</h2>
          <p className="bidi text-base font-semibold">{s.summary}</p>
          <p className="bidi"><span className="text-muted">{t.rootCause}: </span>{s.rootCause}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="label">{t.architecture}</div><ul className="bidi list-disc space-y-0.5 ps-5">{s.architecture.map((x: string) => <li key={x}>{x}</li>)}</ul></div>
            <div><div className="label">{t.steps}</div><ol className="bidi list-decimal space-y-0.5 ps-5">{s.steps.map((x: string) => <li key={x}>{x}</li>)}</ol></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.stack?.map((x: string) => <span key={x} className="chip bg-ink-3 text-muted" dir="ltr">{x}</span>)}
            {s.runningCost && <span className="chip bg-ink-3 text-text">{t.runningCost}: <span dir="auto">{s.runningCost}</span></span>}
          </div>
          {s.risks?.length > 0 && <p className="bidi text-muted">{t.risks}: {s.risks.join(" · ")}</p>}
          {s.sources?.length > 0 && (
            <ul className="space-y-0.5 text-xs">{s.sources.map((u: string) => <li key={u}><a href={u} target="_blank" rel="noreferrer" dir="ltr" className="break-all text-sky hover:underline">{u}</a></li>)}</ul>
          )}
        </section>
      )}

      {d && (
        <section className="card space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-gold">{t.demoTitle}</h2>
            <span className={`chip ${d.works ? "bg-ok text-ink" : "bg-coral text-white"}`}>{d.works ? t.demoWorks : t.demoFails}</span>
          </div>
          <p className="bidi"><span className="text-muted">{t.howToRun}: </span>{d.howToRun}</p>
          {d.files.map((f: { path: string; content: string }) => (
            <details key={f.path} className="rounded-lg border border-line">
              <summary className="cursor-pointer px-3 py-2 font-mono text-xs" dir="ltr">{f.path}</summary>
              <pre className="max-h-96 overflow-auto border-t border-line p-3 text-xs" dir="ltr">{f.content}</pre>
            </details>
          ))}
          <pre className="max-h-64 overflow-auto rounded-lg bg-ink p-3 text-xs" dir="ltr">$ {d.testCommand}{"\n"}{d.testOutput}</pre>
          {d.limitations?.length > 0 && <p className="bidi text-muted">{t.limitations}: {d.limitations.join(" · ")}</p>}
        </section>
      )}

      {r && (
        <section className="card space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-gold">{t.securityTitle}</h2>
            <span className={`chip ${r.verdict === "approve" ? "bg-ok text-ink" : r.verdict === "reject" ? "bg-coral text-white" : "bg-gold text-gold-ink"}`} dir="ltr">{r.verdict}</span>
          </div>
          <p className="bidi">{r.summary}</p>
          <ul className="space-y-1">
            {r.issues.map((i: { severity: string; issue: string; fix: string }) => (
              <li key={i.issue} className="bidi"><span className={`chip me-2 ${SEV[i.severity]}`} dir="ltr">{i.severity}</span>{i.issue} → <span className="text-muted">{i.fix}</span></li>
            ))}
          </ul>
        </section>
      )}

      {o && (
        <section className="card space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gold">{t.outreachTitle}</h2>
            <span className="text-xs text-muted" dir="auto">{o.channel}</span>
          </div>
          <div className="space-y-2">
            <pre className="bidi whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans">{o.message}</pre>
            <CopyButton text={o.message} label={t.copy} done={t.copied} />
          </div>
          <div className="space-y-2">
            <div className="label">{t.followUp}</div>
            <pre className="bidi whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans">{o.followUp}</pre>
            <CopyButton text={o.followUp} label={t.copy} done={t.copied} />
          </div>
          {o.publicReply && (
            <div className="space-y-2">
              <div className="label">{t.publicReply}</div>
              <pre className="bidi whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans">{o.publicReply}</pre>
              <CopyButton text={o.publicReply} label={t.copy} done={t.copied} />
            </div>
          )}
        </section>
      )}

      {dealStage && (
        <section className="card space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["contacted", "replied"] as const).map((st) => (
              <form key={st} action={dealAction}>{hidden}<input type="hidden" name="status" value={st} />
                <button className="btn-ghost" disabled={p.status === st}>{st === "contacted" ? t.markContacted : t.markReplied}</button>
              </form>
            ))}
          </div>
          <form action={dealAction} className="flex flex-wrap items-end gap-3">
            {hidden}
            <div><label className="label" htmlFor="value">{t.dealValueLabel}</label><input id="value" name="value" type="number" min={0} dir="ltr" className="input w-36" defaultValue={p.dealValue ?? undefined} /></div>
            <div className="min-w-48 flex-1"><label className="label" htmlFor="note">{t.noteLabel}</label><input id="note" name="note" dir="auto" className="input" /></div>
            <button name="status" value="won" className="btn-gold">{t.markWon}</button>
            <button name="status" value="lost" className="btn-ghost">{t.markLost}</button>
          </form>
          {p.notes && <pre className="bidi whitespace-pre-wrap text-xs text-muted">{p.notes}</pre>}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {s && (reel
          ? <Link href={`/app/reels/${reel.number}`} className="btn-ghost">{t.reel} {reel.number} ←</Link>
          : <form action={reelFromProblemAction}>{hidden}<button className="btn-gold">🎬 {t.makeReel}</button></form>)}
        {!busy && <form action={rerunProblem}>{hidden}<button className="btn-ghost">↻ {t.rerun}</button></form>}
      </div>
    </div>
  );
}
