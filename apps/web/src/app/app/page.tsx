import { AGENTS, officeState } from "@studio/core";
import { runToday } from "@/app/actions/studio";
import { Activity } from "@/components/Activity";
import { Brief } from "@/components/Brief";
import { Office } from "@/components/Office";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { officeLabels } from "@/lib/office-labels";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const state = await officeState(workspace.id);
  const names = Object.fromEntries(AGENTS.map((a) => [a.id, locale === "ar" ? a.nameAr : a.nameEn]));
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold">{t.office}</h1>
          <form action={runToday}><button className="btn-gold">▶ {t.runToday}</button></form>
        </div>
        <Office initial={state} locale={locale} labels={officeLabels(t)} />
      </div>
      <aside className="order-first space-y-4 xl:order-none">
        <Brief t={t} brief={state.brief} locale={locale} />
        <Activity initial={state.activity} names={names} title={t.activity} empty={t.empty} />
      </aside>
    </div>
  );
}
