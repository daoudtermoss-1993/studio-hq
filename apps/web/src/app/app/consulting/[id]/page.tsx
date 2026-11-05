import Link from "next/link";
import { notFound } from "next/navigation";
import { interviewsOf, ownEngagement, STAGES } from "@studio/core";
import { and, db, eq, inArray, jobs, sql } from "@studio/db";
import { stageAction } from "@/app/actions/consulting";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ConsultBrief } from "@/components/consulting/Brief";
import { ConsultInterviews } from "@/components/consulting/Interviews";
import { ConsultOpportunities } from "@/components/consulting/Opportunities";
import { ConsultPilot } from "@/components/consulting/Pilot";
import { ConsultProposals } from "@/components/consulting/Proposals";
import { STAGE_STYLE } from "@/components/consulting/style";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const TABS = ["brief", "interviews", "opportunities", "proposal", "pilot"] as const;
type Tab = (typeof TABS)[number];

export default async function EngagementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const e = await ownEngagement(workspace.id, id);
  if (!e) notFound();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "brief";
  const [ivs, pending] = await Promise.all([
    interviewsOf(e.id),
    db.select({ type: jobs.type }).from(jobs).where(and(eq(jobs.workspaceId, workspace.id), inArray(jobs.status, ["queued", "running"]), sql`${jobs.payload}->>'engagementId' = ${e.id}`)),
  ]);
  const busyTypes = new Set(pending.map((j) => j.type));
  const busy = busyTypes.size > 0 || ivs.some((i) => !i.synthesis);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {busy && <AutoRefresh every={4000} />}
      <Link href="/app/consulting" className="text-sm text-muted hover:underline">← {t.cs.title}</Link>
      <header className="card flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${STAGE_STYLE[e.stage]}`}>{t.cs.stages[e.stage]}</span>
            <span className="chip bg-ink-3 text-muted">{t.cs.markets[e.market as keyof typeof t.cs.markets] ?? e.market}</span>
            <span className="chip bg-ink-3 text-muted">{t.cs.sources[e.source as keyof typeof t.cs.sources] ?? e.source}</span>
            {busy && <span className="chip bg-gold text-gold-ink">⏳ {t.cs.working}</span>}
          </div>
          <h1 className="bidi font-display text-2xl font-extrabold">{e.company}</h1>
          <p className="text-sm text-muted" dir="auto">{[e.sector, e.country, e.size && `${e.size} 👥`, e.contactRole, e.website].filter(Boolean).join(" · ")}</p>
        </div>
        <form action={stageAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="engagementId" value={e.id} />
          <div>
            <label className="label" htmlFor="stage">{t.cs.stage}</label>
            <select id="stage" name="stage" defaultValue={e.stage} className="input">{STAGES.map((s) => <option key={s} value={s}>{t.cs.stages[s]}</option>)}</select>
          </div>
          <div className="w-32"><label className="label" htmlFor="value">{t.cs.dealValue}</label><input id="value" name="value" dir="ltr" inputMode="numeric" className="input" defaultValue={e.value ?? ""} /></div>
          <button className="btn-ghost">{t.cs.save}</button>
        </form>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-ink-2 p-1">
        {TABS.map((k) => (
          <Link key={k} href={`/app/consulting/${e.id}?tab=${k}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${tab === k ? "bg-gold font-bold text-gold-ink" : "text-muted hover:text-text"}`}>
            {t.cs.tabs[k]}{k === "interviews" && ivs.length > 0 && <span className="ms-1 opacity-70" dir="ltr">({ivs.length})</span>}
          </Link>
        ))}
      </nav>

      {tab === "brief" && <ConsultBrief e={e} t={t} busy={busyTypes.has("research-account")} />}
      {tab === "interviews" && <ConsultInterviews e={e} t={t} ivs={ivs} />}
      {tab === "opportunities" && <ConsultOpportunities e={e} t={t} hasInterviews={ivs.length > 0} mapping={busyTypes.has("map-opportunities")} demoBusy={busyTypes.has("build-demo")} />}
      {tab === "proposal" && <ConsultProposals e={e} t={t} busy={busyTypes.has("write-proposal")} />}
      {tab === "pilot" && <ConsultPilot e={e} t={t} busy={busyTypes.has("plan-pilot") || busyTypes.has("pilot-report")} />}
    </div>
  );
}
