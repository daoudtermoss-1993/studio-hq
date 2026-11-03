import Link from "next/link";
import { engineerName, recentProblems } from "@studio/core";
import { addProblemAction, huntProblemsNow } from "@/app/actions/studio";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COLUMNS = [
  ["new", "qualified", "solving"],
  ["solved"],
  ["contacted", "replied"],
  ["won"],
] as const;
const STATUS_STYLE: Record<string, string> = {
  new: "bg-ink-3 text-muted", qualified: "bg-sky text-ink", solving: "bg-gold text-gold-ink", solved: "bg-ok text-ink",
  contacted: "bg-sky text-ink", replied: "bg-gold text-gold-ink", won: "bg-ok text-ink", lost: "bg-ink-3 text-muted", rejected: "bg-ink-3 text-muted",
};

export default async function SolutionsPage() {
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const all = await recentProblems(workspace.id, 200);
  const won = all.filter((p) => p.status === "won");
  const wonValue = won.reduce((s, p) => s + (p.dealValue ?? 0), 0);
  const busy = all.some((p) => p.status === "new" || p.status === "qualified" || p.status === "solving");
  const closed = all.filter((p) => p.status === "rejected" || p.status === "lost");
  const colTitle = (c: readonly string[]) => c.map((s) => t.pstatus[s as keyof typeof t.pstatus]).join(" · ");

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {busy && <AutoRefresh every={6000} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">{t.solutionsTitle}</h1>
          <p className="max-w-3xl text-sm text-muted">{t.solutionsSub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip bg-ok text-ink">{t.pipelineValue}: <b dir="ltr">${wonValue.toLocaleString("en")}</b> · {won.length} {t.totalDeals}</span>
          <form action={huntProblemsNow}><button className="btn-gold">🔎 {t.huntProblems}</button></form>
        </div>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-bold">＋ {t.addProblem}</summary>
        <form action={addProblemAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="purl">{t.problemUrl}</label><input id="purl" name="url" type="url" required dir="ltr" className="input" placeholder="https://www.reddit.com/r/smallbusiness/…" /></div>
          <div><label className="label" htmlFor="ptitle">{t.problemTitle}</label><input id="ptitle" name="title" dir="auto" className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pbody">{t.problemBody}</label><textarea id="pbody" name="body" required rows={3} dir="auto" className="input" /></div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            {(["smb", "technical"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <input type="radio" name="track" value={k} defaultChecked={k === "smb"} />{t.track[k]}
              </label>
            ))}
            <button className="btn-ghost">{t.addProblem}</button>
          </div>
        </form>
      </details>

      {all.length === 0 && <p className="card text-muted">{t.empty}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = all.filter((p) => (col as readonly string[]).includes(p.status));
          return (
            <section key={col.join()} className="space-y-3">
              <h2 className="flex items-center justify-between font-bold text-gold">
                <span>{colTitle(col)}</span><span className="chip bg-ink-3 text-muted">{items.length}</span>
              </h2>
              {items.map((p) => (
                <Link key={p.id} href={`/app/solutions/${p.id}`} className="card block space-y-2 transition hover:border-gold">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${STATUS_STYLE[p.status]}`}>{t.pstatus[p.status]}</span>
                    <span className="chip bg-ink-3 text-muted">{t.track[p.track as "smb" | "technical"] ?? p.track}</span>
                    <span className="chip bg-ink-3 text-muted" dir="ltr">{p.source}</span>
                    {p.qualification && <span className="chip bg-gold text-gold-ink" dir="ltr">{p.qualification.fitScore}/10</span>}
                  </div>
                  <p className="bidi font-semibold leading-snug">{p.title}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted">
                    {p.qualification?.assignee && <span>👷 {engineerName(p.qualification.assignee, locale)}</span>}
                    {p.qualification?.price?.setup && <span dir="ltr">💵 {p.qualification.price.setup}</span>}
                    {p.dealValue != null && <span className="text-ok" dir="ltr">${p.dealValue}</span>}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
      </div>

      {closed.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-muted">{t.pstatus.rejected} / {t.pstatus.lost} ({closed.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {closed.map((p) => (
              <li key={p.id}><Link className="bidi hover:underline" href={`/app/solutions/${p.id}`}>{t.pstatus[p.status]} — {p.title}</Link></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
