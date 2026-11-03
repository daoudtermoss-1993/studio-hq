import Link from "next/link";
import { notFound } from "next/navigation";
import { and, assets, db, desc, eq, reels } from "@studio/db";
import { answer, approve, posted, requestChanges } from "@/app/actions/studio";
import { AutoRefresh } from "@/components/AutoRefresh";
import { UploadRecording } from "@/components/UploadRecording";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="card">
      <h2 className="mb-3 font-display text-lg font-bold text-gold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ReelPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const [{ workspace, brand }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const n = Number.parseInt(number, 10);
  if (!Number.isFinite(n)) notFound();
  const [reel] = await db.select().from(reels).where(and(eq(reels.workspaceId, workspace.id), eq(reels.number, n)));
  if (!reel) notFound();
  const cover = reel.cover?.assetId ? `/api/assets/${reel.cover.assetId}` : null;
  const [srt] = await db.select().from(assets).where(and(eq(assets.reelId, reel.id), eq(assets.kind, "srt"))).orderBy(desc(assets.createdAt)).limit(1);
  const busy = ["idea", "recorded", "editing", "approved"].includes(reel.status);
  const openQs = (reel.questions ?? []).filter((q) => !q.answer);
  const fmt = (d: Date) => d.toLocaleString(locale === "ar" ? "ar-LB" : "en-GB", { timeZone: brand.timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {busy && <AutoRefresh />}
      <Link href="/app/reels" className="text-sm text-muted hover:text-text">← {t.back}</Link>
      <header className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-muted">#{String(reel.number).padStart(3, "0")}</span>
        <h1 className="bidi font-display text-2xl font-extrabold">{reel.title}</h1>
        <span className="chip bg-gold text-gold-ink">{t.status[reel.status]}</span>
        {reel.pillar && <span className="chip bg-ink-3 text-muted">{reel.pillar}</span>}
      </header>
      {reel.angle && <p className="bidi text-muted">{reel.angle}</p>}

      {openQs.length > 0 && (
        <Section title={t.questions}>
          <ul className="space-y-3">
            {openQs.map((q) => (
              <li key={q.id}>
                <p className="bidi text-sm">{q.text}</p>
                <form action={answer} className="mt-2 flex gap-2">
                  <input type="hidden" name="reelId" value={reel.id} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <input name="answer" className="input" placeholder={t.answer} required />
                  <button className="btn-ghost">{t.send}</button>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {["ready_to_record", "scripted", "recorded", "edited"].includes(reel.status) && reel.teleprompter && (
        <Section title={`🎙️ ${t.uploadRecording}`}>
          <div className="flex flex-wrap items-start gap-3">
            <Link href={`/tp/${reel.number}`} target="_blank" className="btn-ghost">{t.openTeleprompter}</Link>
            <UploadRecording reelId={reel.id} labels={{ upload: t.uploadRecording, uploading: t.uploading, uploaded: t.uploaded }} />
          </div>
        </Section>
      )}

      {reel.finalAssetId && (
        <Section title={t.editReport} id="edit">
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <video controls preload="metadata" className="aspect-[9/16] w-full rounded-xl bg-black" src={`/api/assets/${reel.finalAssetId}`} poster={cover ?? undefined} />
            <div className="space-y-3 text-sm">
              {reel.editReport && (
                <ul className="space-y-1">
                  <li>{t.duration}: <b dir="ltr">{reel.editReport.duration_out}s</b> / {reel.targetSeconds}s</li>
                  <li><b dir="ltr">{reel.editReport.removed_seconds}</b> {t.removedSilence}</li>
                  {reel.editReport.check?.notes && !(reel.editReport.warnings ?? []).includes(reel.editReport.check.notes) && (
                    <li className="bidi text-muted">{reel.editReport.check.notes}</li>
                  )}
                  {(reel.editReport.warnings ?? []).map((w: string) => <li key={w} className="text-xs text-coral" dir="ltr">{w}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <a className="btn-ghost" href={`/api/assets/${reel.finalAssetId}?download`}>⬇ MP4</a>
                {srt && <a className="btn-ghost" href={`/api/assets/${srt.id}?download`}>⬇ SRT</a>}
                {cover && <a className="btn-ghost" href={`${cover}?download`}>⬇ {t.cover}</a>}
              </div>
              {reel.status === "edited" && (
                <div className="space-y-3 rounded-xl border border-gold/40 bg-ink p-3">
                  <form action={approve}>
                    <input type="hidden" name="reelId" value={reel.id} />
                    <button className="btn-gold w-full">✓ {t.approve}</button>
                  </form>
                  <form action={requestChanges} className="space-y-2">
                    <input type="hidden" name="reelId" value={reel.id} />
                    <textarea name="changes" className="input" rows={2} placeholder={t.changesPlaceholder} required />
                    <button className="btn-ghost w-full">{t.requestChanges}</button>
                  </form>
                </div>
              )}
              {reel.status === "scheduled" && reel.publishAt && (
                <div className="space-y-2 rounded-xl border border-ok/40 bg-ink p-3">
                  <p>{t.scheduledFor}: <b>{fmt(reel.publishAt)}</b></p>
                  <form action={posted}><input type="hidden" name="reelId" value={reel.id} /><button className="btn-ghost">{t.markPosted}</button></form>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {reel.captions?.captions && (
        <Section title={t.captions}>
          <div className="grid gap-3 md:grid-cols-2">
            {reel.captions.captions.map((c: any) => (
              <div key={c.platform} className="rounded-xl border border-line bg-ink p-3">
                <p className="mb-1 font-mono text-xs uppercase text-muted" dir="ltr">{c.platform}</p>
                <p className="bidi whitespace-pre-wrap text-sm">{c.text}</p>
                <p className="bidi mt-2 text-xs text-sky">{(c.hashtags ?? []).join(" ")}</p>
              </div>
            ))}
          </div>
          {reel.captions.firstComment && <p className="bidi mt-3 text-sm text-muted">{t.firstComment}: {reel.captions.firstComment}</p>}
        </Section>
      )}

      {reel.cover && (
        <Section title={t.cover}>
          <div className="flex flex-wrap gap-4">
            {cover && <img src={cover} alt={reel.cover.coverText} className="h-48 rounded-lg object-cover" />}
            <div className="text-sm">
              <p className="bidi font-display text-xl font-bold">{reel.cover.coverText}</p>
              <p className="bidi mt-2 max-w-md text-muted">{reel.cover.brief}</p>
            </div>
          </div>
        </Section>
      )}

      {reel.hooks?.hooks && (
        <Section title={t.hooks}>
          <ol className="space-y-2 text-sm">
            {reel.hooks.hooks.map((h: any, i: number) => (
              <li key={i} className={`rounded-lg border p-2 ${i === reel.hooks.chosenIndex ? "border-gold" : "border-line"}`}>
                <span className="chip me-2 bg-ink-3 text-muted" dir="ltr">{h.pattern}</span>
                <span className="bidi">{h.spoken}</span>
                {i === reel.hooks.chosenIndex && <span className="chip ms-2 bg-gold text-gold-ink">{t.chosen}</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {reel.script?.beats && (
        <Section title={t.script}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {reel.script.beats.map((b: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 pe-3 align-top font-mono text-xs text-muted" dir="ltr">{b.start}–{b.end}s</td>
                    <td className="bidi py-2 pe-3 align-top">{b.spoken}</td>
                    <td className="bidi py-2 pe-3 align-top text-gold">{b.onScreen}</td>
                    <td className="bidi py-2 align-top text-muted">{b.visual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {reel.factCheck?.claims && (
        <Section title={t.factCheck}>
          <ul className="space-y-1 text-sm">
            {reel.factCheck.claims.map((c: any, i: number) => (
              <li key={i} className="bidi">
                <span className={c.ok ? "text-ok" : "text-coral"}>{c.ok ? "✓" : "✗"}</span> {c.claim}
                {c.source && <span className="text-muted"> · {c.source}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {reel.repurpose && (
        <Section title={t.repurpose}>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div><h3 className="font-bold">{t.carousel}</h3><ol className="bidi mt-1 list-decimal space-y-1 ps-5">{reel.repurpose.carousel.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>
            <div><h3 className="font-bold">{t.post}</h3><p className="bidi mt-1 whitespace-pre-wrap text-muted">{reel.repurpose.post}</p></div>
            <div><h3 className="font-bold">{t.thread}</h3><ol className="bidi mt-1 list-decimal space-y-1 ps-5">{reel.repurpose.thread.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div>
            <div><h3 className="font-bold">{t.shorts}</h3><p className="bidi mt-1">{reel.repurpose.shortsTitle}</p><p className="bidi text-muted">{reel.repurpose.shortsDescription}</p></div>
          </div>
        </Section>
      )}
    </div>
  );
}
