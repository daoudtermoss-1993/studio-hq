import { dataImports, db, desc, eq } from "@studio/db";
import { importData } from "@/app/actions/studio";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const imports = await db.select().from(dataImports).where(eq(dataImports.workspaceId, workspace.id)).orderBy(desc(dataImports.createdAt)).limit(10);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {imports.some((i) => !i.processed) && <AutoRefresh every={5000} />}
      <h1 className="font-display text-2xl font-extrabold">{t.insightsTitle}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {(["metrics", "comments"] as const).map((kind) => (
          <form key={kind} action={importData} className="card space-y-3">
            <input type="hidden" name="kind" value={kind} />
            <h2 className="font-bold text-gold">{kind === "metrics" ? t.importMetrics : t.importComments}</h2>
            <input type="file" name="file" accept=".csv,.txt,.tsv" className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border-0 file:bg-ink-3 file:px-3 file:py-2 file:text-text" />
            <textarea name="text" rows={4} className="input" dir="auto" />
            <button className="btn-gold">{t.import}</button>
          </form>
        ))}
      </div>
      {imports.map((i) => (
        <section key={i.id} className="card text-sm">
          <h2 className="flex items-center gap-2 font-bold">
            <span className="chip bg-ink-3 text-muted" dir="ltr">{i.kind}</span>
            <span dir="ltr">{i.filename}</span>
            {!i.processed && <span className="text-muted">· {t.working}</span>}
          </h2>
          {i.result && i.kind === "metrics" && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="font-bold text-gold">{t.recommendations}</h3>
                <ul className="bidi mt-1 list-disc space-y-1 ps-5">{(i.result.recommendations ?? []).map((r: string) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div>
                <h3 className="font-bold text-gold">{t.results}</h3>
                <ul className="bidi mt-1 space-y-1">{[...(i.result.top ?? []), ...(i.result.patterns ?? [])].map((r: string) => <li key={r}>{r}</li>)}</ul>
              </div>
            </div>
          )}
          {i.result && i.kind === "comments" && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="font-bold text-gold">{t.replies}</h3>
                <ul className="mt-1 space-y-2">{(i.result.replies ?? []).map((r: any, k: number) => <li key={k} className="bidi"><b dir="ltr">@{r.user}</b>: {r.comment}<br /><span className="text-ok">↳ {r.reply}</span></li>)}</ul>
              </div>
              <div>
                <h3 className="font-bold text-gold">{t.dmList}</h3>
                <ul className="mt-1 space-y-2">{(i.result.dmList ?? []).map((d: any, k: number) => <li key={k} className="bidi"><b dir="ltr">@{d.user}</b>: {d.message}</li>)}</ul>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
