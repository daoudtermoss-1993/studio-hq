import { localDate } from "@studio/core";
import { and, db, desc, eq, ideas, trendReports } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const [{ workspace, brand }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const [trend] = await db.select().from(trendReports)
    .where(and(eq(trendReports.workspaceId, workspace.id), eq(trendReports.date, localDate(brand.timezone))));
  const bank = await db.select().from(ideas).where(eq(ideas.workspaceId, workspace.id)).orderBy(desc(ideas.score), desc(ideas.createdAt)).limit(100);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card">
        <h1 className="mb-3 font-display text-xl font-extrabold text-gold">{t.trendsToday}</h1>
        {!trend && <p className="text-sm text-muted">{t.noTrends}</p>}
        <ul className="space-y-3">
          {(trend?.items ?? []).map((x: any, i: number) => (
            <li key={i} className="rounded-xl border border-line bg-ink p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className={`chip ${x.freshness === "hot" ? "bg-coral text-white" : "bg-ink-3 text-muted"}`} dir="ltr">{x.freshness}</span>
                {!x.confirmed && <span className="chip bg-ink-3 text-coral" dir="ltr">unconfirmed</span>}
                <b className="bidi">{x.title}</b>
              </div>
              <p className="bidi mt-1 text-muted">{x.whyItMatters}</p>
              <p className="bidi mt-1">→ {x.angle}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(x.sources ?? []).map((s: string) => (
                  <a key={s} href={s} target="_blank" rel="noreferrer" className="truncate text-xs text-sky underline" dir="ltr">{s.replace(/^https?:\/\//, "").slice(0, 40)}</a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h1 className="mb-3 font-display text-xl font-extrabold text-gold">{t.ideasTitle}</h1>
        {bank.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}
        <ul className="divide-y divide-line text-sm">
          {bank.map((i) => (
            <li key={i.id} className={`py-2 ${i.used ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="chip bg-ink-3 font-mono text-muted" dir="ltr">{i.score}</span>
                {i.pillar && <span className="chip bg-ink-3 text-muted">{i.pillar}</span>}
                <span className="bidi font-semibold">{i.text}</span>
              </div>
              {i.angle && <p className="bidi mt-1 text-muted">{i.angle}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
