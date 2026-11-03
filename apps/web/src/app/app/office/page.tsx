import { officeState } from "@studio/core";
import { Office } from "@/components/Office";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { officeLabels } from "@/lib/office-labels";

export const dynamic = "force-dynamic";

export default async function OfficePage() {
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const state = await officeState(workspace.id);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-extrabold">{t.office}</h1>
      <Office initial={state} locale={locale} labels={officeLabels(t)} />
    </div>
  );
}
