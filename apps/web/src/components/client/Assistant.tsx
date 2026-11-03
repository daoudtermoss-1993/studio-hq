import type { Client } from "@studio/db";
import { settingsOf } from "@studio/core";
import { autoReplyAction, runEvalAction } from "@/app/actions/clients";
import { ChatWidget } from "@/components/ChatWidget";
import type { T } from "@/lib/i18n";

export function ClientAssistant({ c, t, ev }: { c: Client; t: T; ev: any }) {
  const s = settingsOf(c);
  const hidden = <input type="hidden" name="clientId" value={c.id} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div className="space-y-3">
        {c.knowledge ? (
          <ChatWidget endpoint={`/api/clients/${c.id}/chat`} title={c.name} subtitle={t.cl.chatSub} placeholder={t.cl.placeholder} send={t.cl.send}
            typing={t.cl.typing} handoffNote={t.cl.handoffNote} limitNote={t.cl.limitNote} suggestions={t.cl.suggestions} persistKey={`chat:${c.id}`} />
        ) : (
          <div className="card grid h-60 place-items-center text-center text-sm text-muted">{t.cl.kbBuilding}</div>
        )}
        <div className="card space-y-2 text-sm">
          <p className="text-muted">{t.cl.evalGate}</p>
          <form action={autoReplyAction}>
            {hidden}
            <input type="hidden" name="on" value={s.autoReply ? "0" : "1"} />
            <button className={s.autoReply ? "btn-ghost" : "btn-gold"} disabled={!s.autoReply && !s.evalPassed}>{s.autoReply ? t.cl.disableAuto : t.cl.enableAuto}</button>
          </form>
        </div>
      </div>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gold">{t.cl.evalTitle}</h2>
          <form action={runEvalAction}>{hidden}<button className="btn-ghost px-3 py-1.5 text-xs">↻ {t.cl.rerunEval}</button></form>
        </div>
        {!ev ? <p className="text-sm text-muted">{t.cl.noEval}</p> : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className={`font-display text-5xl font-extrabold ${ev.score / ev.total >= 0.9 ? "text-ok" : "text-coral"}`} dir="ltr">{ev.score}/{ev.total}</div>
              <div className="min-w-60 flex-1 space-y-1 text-sm">
                <p className="bidi">{ev.summary}</p>
                {ev.fixes?.length > 0 && <ul className="bidi list-disc ps-5 text-muted">{ev.fixes.map((f: string) => <li key={f}>{f}</li>)}</ul>}
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <tbody>
                  {ev.cases.map((k: any) => (
                    <tr key={k.id} className="border-b border-line align-top last:border-0">
                      <td className="p-2"><span className={`chip ${k.pass ? "bg-ok text-ink" : "bg-coral text-white"}`}>{k.pass ? t.cl.evalPass : t.cl.evalFail}</span></td>
                      <td className="p-2 text-xs text-muted" dir="ltr">{k.category}</td>
                      <td className="bidi p-2"><div className="font-semibold">{k.message}</div><div className="text-muted">→ {k.reply}</div>{!k.pass && <div className="text-xs text-coral">{k.reason}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
