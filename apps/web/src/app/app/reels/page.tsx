import Link from "next/link";
import { PIPELINE } from "@studio/core";
import { asc, db, eq, reels } from "@studio/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ReelsBoard() {
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const all = await db.select().from(reels).where(eq(reels.workspaceId, workspace.id)).orderBy(asc(reels.number));
  return (
    <div>
      <AutoRefresh every={6000} />
      <h1 className="mb-4 font-display text-2xl font-extrabold">{t.nav.reels}</h1>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE.map((s) => {
          const list = all.filter((r) => r.status === s);
          return (
            <section key={s} className="w-64 shrink-0 rounded-2xl border border-line bg-ink-2 p-3">
              <h2 className="mb-2 flex items-center justify-between text-sm font-bold">
                <span>{t.status[s]}</span><span className="chip bg-ink-3 text-muted">{list.length}</span>
              </h2>
              <ul className="space-y-2">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/app/reels/${r.number}`} className="block rounded-xl border border-line bg-ink p-3 hover:border-gold">
                      <span className="font-mono text-xs text-muted">#{String(r.number).padStart(3, "0")}</span>
                      <p className="bidi mt-1 text-sm font-semibold">{r.title}</p>
                      {r.pillar && <span className="chip mt-2 bg-ink-3 text-muted">{r.pillar}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
