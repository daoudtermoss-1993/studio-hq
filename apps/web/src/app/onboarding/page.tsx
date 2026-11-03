import { redirect } from "next/navigation";
import { db, eq, memberships } from "@studio/db";
import { createStudio } from "@/app/actions/studio";
import { BrandForm } from "@/components/BrandForm";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Onboarding" };

export default async function Onboarding() {
  const user = await requireUser();
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, user.id)).limit(1);
  if (m) redirect("/app");
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">{t.onboardingTitle}</h1>
      <p className="mb-8 mt-2 text-muted">{t.onboardingSub}</p>
      <div className="card">
        <BrandForm t={t} studioName={user.name} submit={t.createStudio} action={createStudio} />
      </div>
    </main>
  );
}
