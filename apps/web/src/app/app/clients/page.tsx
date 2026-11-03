import Link from "next/link";
import { latestArtifact, settingsOf } from "@studio/core";
import { clients, db, desc, eq } from "@studio/db";
import { createClientAction } from "@/app/actions/clients";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const list = await db.select().from(clients).where(eq(clients.workspaceId, workspace.id)).orderBy(desc(clients.createdAt));
  const evals = Object.fromEntries(await Promise.all(list.map(async (c) => [c.id, (await latestArtifact(c.id, "evaluation"))?.data] as const)));
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{t.cl.title}</h1>
        <p className="max-w-3xl text-sm text-muted">{t.cl.sub}</p>
      </div>
      {list.length === 0 && <p className="card text-muted">{t.cl.empty}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const s = settingsOf(c);
          const ev = evals[c.id];
          return (
            <Link key={c.id} href={`/app/clients/${c.id}`} className="card block space-y-2 transition hover:border-gold">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${c.status === "active" ? "bg-ok text-ink" : c.status === "paused" ? "bg-ink-3 text-muted" : "bg-gold text-gold-ink"}`}>{t.cl.status[c.status]}</span>
                {ev && <span className={`chip ${ev.score / ev.total >= 0.9 ? "bg-ok text-ink" : "bg-coral text-white"}`} dir="ltr">{ev.score}/{ev.total}</span>}
                <span className="chip bg-ink-3 text-muted">{s.autoReply ? t.cl.mode.auto : t.cl.tabs.assistant}</span>
              </div>
              <p className="bidi text-lg font-bold">{c.name}</p>
              <p className="text-sm text-muted" dir="auto">{[c.vertical, c.city].filter(Boolean).join(" · ") || c.website}</p>
            </Link>
          );
        })}
      </div>
      <details className="card">
        <summary className="cursor-pointer font-bold">＋ {t.cl.newClient}</summary>
        <form action={createClientAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="cname">{t.cl.name}</label><input id="cname" name="name" required dir="auto" className="input" /></div>
          <div><label className="label" htmlFor="cweb">{t.cl.website}</label><input id="cweb" name="website" dir="ltr" className="input" placeholder="clinic.com" /></div>
          <div><label className="label" htmlFor="cphone">{t.cl.phone}</label><input id="cphone" name="phone" dir="ltr" className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="cvert">{t.cl.vertical}</label><input id="cvert" name="vertical" dir="auto" className="input" /></div>
            <div><label className="label" htmlFor="ccity">{t.cl.city}</label><input id="ccity" name="city" dir="auto" className="input" /></div>
          </div>
          <div className="sm:col-span-2"><label className="label" htmlFor="cnotes">{t.cl.notes}</label><textarea id="cnotes" name="notes" rows={4} dir="auto" className="input" /></div>
          <div><button className="btn-gold">{t.cl.create}</button></div>
        </form>
      </details>
    </div>
  );
}
