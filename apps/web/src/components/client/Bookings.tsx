import type { Client } from "@studio/db";
import { bookings, db, desc, eq } from "@studio/db";
import { bookingAction } from "@/app/actions/clients";
import type { T } from "@/lib/i18n";

export async function ClientBookings({ c, t, locale }: { c: Client; t: T; locale: string }) {
  const rows = await db.select().from(bookings).where(eq(bookings.clientId, c.id)).orderBy(desc(bookings.createdAt)).limit(200);
  const fmt = (d: Date | null) => (d ? d.toLocaleString(locale === "ar" ? "ar-LB" : "en-GB", { timeZone: c.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const hidden = (id: string) => (<><input type="hidden" name="clientId" value={c.id} /><input type="hidden" name="bookingId" value={id} /></>);
  const requested = rows.filter((b) => b.status === "requested");
  const confirmed = rows.filter((b) => b.status === "confirmed");
  const past = rows.filter((b) => !["requested", "confirmed"].includes(b.status));
  if (!rows.length) return <p className="card text-muted">{t.cl.noBookings}</p>;
  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="font-bold text-gold">{t.cl.requested} ({requested.length})</h2>
        {requested.map((b) => (
          <form key={b.id} action={bookingAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3 text-sm">
            {hidden(b.id)}
            <div className="min-w-48 flex-1 bidi"><b>{b.name || "—"}</b> · {b.service} · <span className="text-muted">{b.preferredTime}</span>{b.phone && <span className="text-muted" dir="ltr"> · {b.phone}</span>}</div>
            <div><label className="label" htmlFor={`at-${b.id}`}>{t.cl.when}</label><input id={`at-${b.id}`} type="datetime-local" name="startsAt" required className="input" dir="ltr" /></div>
            <button name="status" value="confirmed" className="btn-gold">{t.cl.confirm}</button>
            <button name="status" value="declined" formNoValidate className="btn-ghost">{t.cl.decline}</button>
          </form>
        ))}
      </section>
      <section className="card space-y-2">
        <h2 className="font-bold text-gold">{t.cl.confirmed} ({confirmed.length})</h2>
        {confirmed.map((b) => (
          <form key={b.id} action={bookingAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 text-sm">
            {hidden(b.id)}
            <div className="min-w-48 flex-1 bidi"><b>{b.name}</b> · {b.service} · <span dir="ltr">{fmt(b.startsAt)}</span>{b.remindedAt && <span className="text-ok"> · ⏰ ✓</span>}</div>
            <button name="status" value="done" className="btn-ghost">{t.cl.done}</button>
            <button name="status" value="no_show" className="btn-ghost">{t.cl.noShow}</button>
          </form>
        ))}
      </section>
      {past.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer text-muted">… {past.length}</summary>
          <ul className="mt-2 space-y-1">{past.map((b) => <li key={b.id} className="bidi">{b.name} · {b.service} · <span dir="ltr">{fmt(b.startsAt)}</span> · <span className="text-muted" dir="ltr">{b.status}</span></li>)}</ul>
        </details>
      )}
    </div>
  );
}
