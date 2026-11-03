import Link from "next/link";
import { and, db, desc, eq, ne, reels, viralFinds } from "@studio/db";
import { addViral, adoptFind, analyzeFind, dismissFind, huntNow } from "@/app/actions/studio";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
const PLATFORM_STYLE: Record<string, string> = {
  youtube: "bg-[#ff4d5e] text-white", tiktok: "bg-[#25f4ee] text-ink", instagram: "bg-[#d62976] text-white", facebook: "bg-[#1877f2] text-white", other: "bg-ink-3 text-muted",
};

export default async function ViralPage() {
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const finds = await db
    .select()
    .from(viralFinds)
    .where(and(eq(viralFinds.workspaceId, workspace.id), ne(viralFinds.status, "dismissed")))
    .orderBy(desc(viralFinds.createdAt))
    .limit(60);
  const reelNums = Object.fromEntries(
    (await db.select({ id: reels.id, number: reels.number }).from(reels).where(eq(reels.workspaceId, workspace.id))).map((r) => [r.id, r.number]),
  );
  const pending = finds.some((f) => f.status === "new");
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {pending && <AutoRefresh every={5000} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t.viralTitle}</h1>
          <p className="max-w-2xl text-sm text-muted">{t.viralSub}</p>
        </div>
        <form action={huntNow}><button className="btn-gold">🔎 {t.huntNow}</button></form>
      </div>

      <form action={addViral} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="url">{t.addLink}</label>
          <input id="url" name="url" type="url" required dir="ltr" className="input" placeholder="https://www.tiktok.com/@… / instagram.com/reel/… / youtube.com/shorts/…" />
        </div>
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="note">{t.addLinkNote}</label>
          <input id="note" name="note" className="input" />
        </div>
        <button className="btn-ghost">{t.analyze}</button>
      </form>

      {finds.length === 0 && <p className="card text-muted">{t.empty}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {finds.map((f) => {
          const a = f.analysis;
          return (
            <article key={f.id} className="card space-y-3">
              <header className="flex flex-wrap items-center gap-2">
                <span className={`chip ${PLATFORM_STYLE[f.platform] ?? PLATFORM_STYLE.other}`} dir="ltr">{f.platform}</span>
                <span className="chip bg-ink-3 text-muted">{t.viralStatus[f.status]}</span>
                {a && <span className="chip bg-gold text-gold-ink">{t.fit} {a.fitScore}/10</span>}
                <a href={f.url} target="_blank" rel="noreferrer" className="bidi min-w-0 flex-1 truncate font-semibold hover:underline">{f.title || f.url}</a>
              </header>
              <div className="flex flex-wrap gap-4 text-sm text-muted">
                {f.creator && <span dir="ltr">{f.creator}</span>}
                <span><b className="text-text" dir="ltr">{fmt(f.views)}</b> {t.views}</span>
                {f.velocity != null && <span><b className="text-text" dir="ltr">{fmt(f.velocity)}</b> {t.perHour}</span>}
                {f.outlier != null && <span><b className="text-gold" dir="ltr">×{f.outlier}</b> {t.outlier}</span>}
              </div>
              {a ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <h3 className="font-bold text-gold">{t.whyItWorks}</h3>
                    <ul className="bidi mt-1 list-disc space-y-0.5 ps-5">{a.whyItWorks.map((w: string) => <li key={w}>{w}</li>)}</ul>
                    <p className="bidi mt-2 text-muted">{a.hookType} · {a.pacing} · {a.emotion}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-gold">{t.ourRemake}</h3>
                    <p className="bidi mt-1 font-semibold">{a.remake.title}</p>
                    <p className="bidi text-muted">{a.remake.angle} — {a.remake.ourTwist}</p>
                    {a.reactIdea && <p className="bidi mt-2 text-xs text-sky">{t.reactIdea}: {a.reactIdea}</p>}
                  </div>
                </div>
              ) : (
                f.description && <p className="bidi text-sm text-muted">{f.description}</p>
              )}
              <footer className="flex flex-wrap gap-2">
                {f.status === "adopted" && f.reelId && reelNums[f.reelId] && (
                  <Link href={`/app/reels/${reelNums[f.reelId]}`} className="btn-ghost">{t.reel} {reelNums[f.reelId]} ←</Link>
                )}
                {f.status === "analyzed" && (
                  <form action={adoptFind}><input type="hidden" name="findId" value={f.id} /><button className="btn-gold">{t.adopt}</button></form>
                )}
                {f.status === "new" && (
                  <form action={analyzeFind}><input type="hidden" name="findId" value={f.id} /><button className="btn-ghost">{t.analyze}</button></form>
                )}
                {f.status !== "adopted" && (
                  <form action={dismissFind}><input type="hidden" name="findId" value={f.id} /><button className="btn-ghost">{t.dismiss}</button></form>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
