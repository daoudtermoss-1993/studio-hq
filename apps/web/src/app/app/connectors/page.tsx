import { AGENTS, builtInSources, secretReady } from "@studio/core";
import { connectors, db, desc, eq } from "@studio/db";
import { addConnectorAction, connectorAction } from "@/app/actions/studio";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const ENGINEERING = new Set(["problem-hunter", "chief-engineer", "automation-engineer", "ai-engineer", "network-engineer", "software-engineer", "security-reviewer", "outreach-writer", "opportunity-scout", "web-auditor", "web-designer", "knowledge-engineer", "receptionist", "qa-engineer", "care-coordinator", "reputation-manager", "growth-marketer", "client-success"]);

export default async function ConnectorsPage() {
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const list = await db
    .select({ id: connectors.id, name: connectors.name, url: connectors.url, agents: connectors.agents, enabled: connectors.enabled, hasToken: connectors.tokenEnc })
    .from(connectors)
    .where(eq(connectors.workspaceId, workspace.id))
    .orderBy(desc(connectors.createdAt));
  const name = (id: string) => (id === "*" ? t.everyone : (locale === "ar" ? AGENTS.find((a) => a.id === id)?.nameAr : AGENTS.find((a) => a.id === id)?.nameEn) ?? id);
  const engineers = AGENTS.filter((a) => ENGINEERING.has(a.id));
  const others = AGENTS.filter((a) => !ENGINEERING.has(a.id));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{t.connectorsTitle}</h1>
        <p className="max-w-3xl text-sm text-muted">{t.connectorsSub}</p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-bold text-gold">{t.builtIn}</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {builtInSources().map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <span>{t.src[s.id as keyof typeof t.src] ?? s.id}</span>
              <span className={`chip ${s.ready ? "bg-ok text-ink" : "bg-ink-3 text-muted"}`}>{s.ready ? t.ready : t.needsKey}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold text-gold">{t.mcpServers}</h2>
        <p className="text-xs text-muted">⚠️ {t.connectorWarn}</p>
        {!secretReady() && <p className="rounded-lg border border-coral px-3 py-2 text-sm text-coral">{t.needsAppSecret}</p>}
        {list.length === 0 && <p className="text-sm text-muted">{t.noConnectors}</p>}
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm">
              <b dir="ltr">{c.name}</b>
              <span className="min-w-0 flex-1 truncate text-xs text-muted" dir="ltr">{c.url}{c.hasToken ? " · 🔒" : ""}</span>
              <span className="text-xs">{c.agents.map(name).join("، ")}</span>
              <span className={`chip ${c.enabled ? "bg-ok text-ink" : "bg-ink-3 text-muted"}`}>{c.enabled ? t.ready : t.disable}</span>
              <form action={connectorAction}>
                <input type="hidden" name="connectorId" value={c.id} />
                <button name="op" value={c.enabled ? "disable" : "enable"} className="btn-ghost px-3 py-1.5 text-xs">{c.enabled ? t.disable : t.enable}</button>
                <button name="op" value="remove" className="btn-ghost ms-2 px-3 py-1.5 text-xs">{t.remove}</button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addConnectorAction} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="cname">{t.connectorName}</label><input id="cname" name="name" required pattern="[a-z0-9-]{2,40}" dir="ltr" className="input" placeholder="github" /></div>
          <div><label className="label" htmlFor="curl">{t.connectorUrl}</label><input id="curl" name="url" type="url" required pattern="https://.*" dir="ltr" className="input" placeholder="https://mcp.example.com/mcp" /></div>
          <div><label className="label" htmlFor="ctoken">{t.connectorToken}</label><input id="ctoken" name="token" type="password" autoComplete="off" dir="ltr" className="input" /></div>
          <fieldset className="sm:col-span-3">
            <legend className="label">{t.whoUses}</legend>
            <div className="space-y-2">
              <label className="me-3 inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="agents" value="*" />{t.everyone}</label>
              <div className="text-xs text-muted">{t.engineeringFloor}</div>
              <div className="flex flex-wrap gap-2">
                {engineers.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                    <input type="checkbox" name="agents" value={a.id} defaultChecked={a.id !== "outreach-writer" && a.id !== "problem-hunter"} />{name(a.id)}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {others.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted">
                    <input type="checkbox" name="agents" value={a.id} />{name(a.id)}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
          <div><button className="btn-gold">{t.addConnector}</button></div>
        </form>
      </section>
    </div>
  );
}
