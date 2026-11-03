import type { Client } from "@studio/db";
import { latestArtifact } from "@studio/core";
import { and, clientContacts, db, eq, sql } from "@studio/db";
import { clientJobAction, importContactsAction } from "@/app/actions/clients";
import { CopyButton } from "@/components/CopyButton";
import type { T } from "@/lib/i18n";

export async function ClientGrowth({ c, t }: { c: Client; t: T }) {
  const [{ all, opted }] = await db
    .select({ all: sql<number>`count(*)`, opted: sql<number>`count(*) filter (where ${clientContacts.optIn})` })
    .from(clientContacts).where(and(eq(clientContacts.clientId, c.id)));
  const [camp, tpl] = await Promise.all([latestArtifact(c.id, "campaign"), latestArtifact(c.id, "templates")]);
  const hidden = <input type="hidden" name="clientId" value={c.id} />;
  const job = (name: string, label: string) => (
    <form action={clientJobAction}>{hidden}<input type="hidden" name="job" value={name} /><input type="hidden" name="tab" value="growth" /><button className="btn-ghost">{label}</button></form>
  );
  return (
    <div className="space-y-4">
      <form action={importContactsAction} className="card space-y-2">
        {hidden}
        <label className="label" htmlFor="csv">{t.cl.contacts}</label>
        <textarea id="csv" name="csv" rows={4} dir="ltr" className="input font-mono text-xs" placeholder={"Rim, +961 3 111 222, yes, 2025-03-01"} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-gold">{t.cl.importContacts}</button>
          <span className="text-sm text-muted"><b className="text-text" dir="ltr">{Number(all)}</b> · <b className="text-ok" dir="ltr">{Number(opted)}</b> {t.cl.optedIn}</span>
        </div>
      </form>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gold">{t.cl.campaign}</h2>
          {job("client-campaign", t.cl.draftCampaign)}
        </div>
        {camp && (
          <div className="space-y-2 text-sm">
            <p className="bidi text-lg font-bold">{camp.data.name}</p>
            <p className="bidi"><span className="text-muted">{t.cl.audience}: </span><b dir="ltr">{camp.data.audience}</b> · {camp.data.segment}</p>
            <p className="bidi text-muted">{camp.data.why} · {camp.data.expected}</p>
            <pre className="bidi whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans">{camp.data.template.body}</pre>
            <div className="flex items-center gap-2"><code className="text-xs" dir="ltr">{camp.data.template.name} · {camp.data.template.language}</code><CopyButton text={camp.data.template.body} label={t.copy} done={t.copied} /></div>
          </div>
        )}
      </section>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gold">{t.cl.templates}</h2>
          {job("client-templates", t.cl.writeTemplates)}
        </div>
        {tpl?.data.templates.map((x: any) => (
          <div key={x.name} className="space-y-1 rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><code dir="ltr">{x.name}</code><span className="chip bg-ink-3 text-muted" dir="ltr">{x.category} · {x.language}</span><CopyButton text={x.body} label={t.copy} done={t.copied} /></div>
            <p className="bidi">{x.body}</p>
            {x.example && <p className="text-xs text-muted" dir="auto">e.g. {x.example}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}
