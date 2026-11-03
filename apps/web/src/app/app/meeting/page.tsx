import { SKILLS, type SkillId } from "@studio/core";
import { and, db, desc, eq, lessons, retros } from "@studio/db";
import { lessonDecision, runMeeting } from "@/app/actions/studio";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function MeetingPage() {
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const all = await db.select().from(lessons).where(eq(lessons.workspaceId, workspace.id)).orderBy(desc(lessons.createdAt));
  const history = await db.select().from(retros).where(eq(retros.workspaceId, workspace.id)).orderBy(desc(retros.createdAt)).limit(8);
  const skillName = (s: string) => (locale === "ar" ? SKILLS[s as SkillId]?.nameAr : SKILLS[s as SkillId]?.nameEn) ?? s;
  const proposed = all.filter((l) => l.status === "proposed");
  const approved = all.filter((l) => l.status === "approved");
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">{t.meetingTitle}</h1>
        <form action={runMeeting}><button className="btn-gold">{t.runMeeting}</button></form>
      </div>
      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-gold">{t.proposed}</h2>
        {proposed.length === 0 && <p className="text-sm text-muted">{t.noProposals}</p>}
        <ul className="space-y-3">
          {proposed.map((l) => (
            <li key={l.id} className="rounded-xl border border-line bg-ink p-3">
              <span className="chip bg-ink-3 text-muted">{skillName(l.skill)}</span>
              <p className="bidi mt-2 font-semibold">{l.text}</p>
              {l.evidence && <p className="bidi mt-1 text-sm text-muted">{l.evidence}</p>}
              <div className="mt-3 flex gap-2">
                {(["approved", "rejected"] as const).map((d) => (
                  <form key={d} action={lessonDecision}>
                    <input type="hidden" name="lessonId" value={l.id} />
                    <input type="hidden" name="decision" value={d} />
                    <button className={d === "approved" ? "btn-gold" : "btn-ghost"}>{d === "approved" ? t.approveLesson : t.rejectLesson}</button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-gold">{t.approved} ({approved.length})</h2>
        <ul className="space-y-1 text-sm">
          {approved.map((l) => <li key={l.id} className="bidi"><span className="chip me-2 bg-ink-3 text-muted">{skillName(l.skill)}</span>{l.text}</li>)}
        </ul>
      </section>
      {history.length > 0 && (
        <section className="card">
          <ul className="space-y-3 text-sm">
            {history.map((r) => (
              <li key={r.id}>
                <p className="font-mono text-xs text-muted" dir="ltr">{r.createdAt.toISOString().slice(0, 10)}</p>
                <p className="bidi whitespace-pre-wrap">{r.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
