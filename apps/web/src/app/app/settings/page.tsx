import { saveBrand } from "@/app/actions/studio";
import { BrandForm } from "@/components/BrandForm";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function SettingsPage() {
  const [{ workspace, brand }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 font-display text-2xl font-extrabold">{t.settingsTitle}</h1>
      <div className="card">
        <BrandForm t={t} brand={brand} studioName={workspace.name} submit={t.save} action={saveBrand} />
      </div>
    </div>
  );
}
