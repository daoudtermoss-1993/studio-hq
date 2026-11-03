import Link from "next/link";
import type { Client } from "@studio/db";
import { conversationMessages } from "@studio/core";
import { and, conversations, db, desc, eq, ne } from "@studio/db";
import { releaseHandoffAction, sendDraftAction, staffReplyAction } from "@/app/actions/clients";
import type { T } from "@/lib/i18n";

export async function ClientInbox({ c, t, convId, locale }: { c: Client; t: T; convId?: string; locale: string }) {
  const list = await db.select().from(conversations).where(and(eq(conversations.clientId, c.id), ne(conversations.channel, "test"))).orderBy(desc(conversations.handoff), desc(conversations.lastMessageAt)).limit(100);
  const current = list.find((x) => x.id === convId) ?? list[0];
  const msgs = current ? await conversationMessages(current.id) : [];
  const hidden = <input type="hidden" name="clientId" value={c.id} />;
  if (!list.length) return <p className="card text-muted">{t.cl.inboxEmpty}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <ul className="card max-h-[640px] space-y-1 overflow-auto p-2">
        {list.map((x) => (
          <li key={x.id}>
            <Link href={`/app/clients/${c.id}?tab=inbox&conv=${x.id}`} className={`block rounded-lg px-3 py-2 text-sm ${x.id === current?.id ? "bg-ink-3" : "hover:bg-ink-3/60"}`}>
              <div className="flex items-center justify-between gap-2">
                <b dir="auto" className="truncate">{x.contactName || (x.channel === "demo" ? "Demo" : x.contact)}</b>
                <span className="text-[10px] text-muted" dir="ltr">{x.lastMessageAt.toLocaleString(locale === "ar" ? "ar-LB" : "en-GB", { timeZone: c.timezone, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
              </div>
              <div className="flex gap-1 pt-1">
                <span className="chip bg-ink-3 text-muted" dir="ltr">{x.channel}</span>
                {x.handoff && <span className="chip bg-coral text-white">{t.cl.needsHuman}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {current && (
        <section className="card space-y-3">
          {current.handoff && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-coral px-3 py-2 text-sm">
              <span className="text-coral">⚠ {t.cl.needsHuman}: <span dir="auto">{current.handoffReason}</span></span>
              <form action={releaseHandoffAction}>{hidden}<input type="hidden" name="conversationId" value={current.id} /><button className="btn-ghost px-3 py-1.5 text-xs">{t.cl.releaseHandoff}</button></form>
            </div>
          )}
          <div className="max-h-[480px] space-y-2 overflow-auto">
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-ink-3" : m.status === "draft" ? "border border-dashed border-gold bg-ink" : m.role === "staff" ? "bg-sky/20" : "bg-ok/15"}`}>
                  {m.status === "draft" ? (
                    <form action={sendDraftAction} className="space-y-2">
                      {hidden}<input type="hidden" name="messageId" value={m.id} />
                      <div className="text-xs font-bold text-gold">{t.cl.draftLabel} · <span dir="ltr">{m.intent}</span></div>
                      <textarea name="text" defaultValue={m.text} rows={3} dir="auto" className="input min-w-64" />
                      <button className="btn-gold px-3 py-1.5 text-xs">{t.cl.approveSend}</button>
                    </form>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap" dir="auto">{m.text}</p>
                      <div className="mt-1 text-[10px] text-muted" dir="ltr">{m.role} · {m.status}{m.intent ? ` · ${m.intent}` : ""}</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form action={staffReplyAction} className="flex gap-2">
            {hidden}<input type="hidden" name="conversationId" value={current.id} />
            <input name="text" required dir="auto" className="input flex-1" placeholder={t.cl.staffReply} />
            <button className="btn-ghost">{t.cl.send}</button>
          </form>
        </section>
      )}
    </div>
  );
}
