import Link from "next/link";
import { localDate } from "@studio/core";
import { and, asc, db, eq, inArray, isNotNull, reels } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [{ workspace, brand }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const rows = await db.select().from(reels)
    .where(and(eq(reels.workspaceId, workspace.id), isNotNull(reels.publishAt), inArray(reels.status, ["scheduled", "posted"])))
    .orderBy(asc(reels.publishAt));
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = localDate(brand.timezone, r.publishAt!);
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }
  const loc = locale === "ar" ? "ar-LB" : "en-GB";
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 font-display text-2xl font-extrabold">{t.nav.calendar}</h1>
      {rows.length === 0 && <p className="card text-muted">{t.noneScheduled}</p>}
      <ol className="space-y-3">
        {[...byDay.entries()].map(([day, list]) => (
          <li key={day} className="card">
            <h2 className="font-bold text-gold">{new Date(`${day}T12:00:00`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {list.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="font-mono text-muted" dir="ltr">{r.publishAt!.toLocaleTimeString("en-GB", { timeZone: brand.timezone, hour: "2-digit", minute: "2-digit" })}</span>
                  <Link className="bidi hover:underline" href={`/app/reels/${r.number}`}>{t.reel} {r.number}: {r.title}</Link>
                  <span className={`chip ${r.status === "posted" ? "bg-ok text-ink" : "bg-ink-3 text-muted"}`}>{t.status[r.status]}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
