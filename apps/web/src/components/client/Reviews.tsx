import type { Client } from "@studio/db";
import { clientReviews, db, desc, eq } from "@studio/db";
import { addReviewsAction, approveReviewAction, clientJobAction } from "@/app/actions/clients";
import { CopyButton } from "@/components/CopyButton";
import type { T } from "@/lib/i18n";

export async function ClientReviews({ c, t }: { c: Client; t: T }) {
  const rows = await db.select().from(clientReviews).where(eq(clientReviews.clientId, c.id)).orderBy(desc(clientReviews.createdAt)).limit(100);
  const hidden = <input type="hidden" name="clientId" value={c.id} />;
  return (
    <div className="space-y-4">
      <form action={addReviewsAction} className="card space-y-2">
        {hidden}
        <label className="label" htmlFor="reviews">{t.cl.addReviews}</label>
        <textarea id="reviews" name="reviews" rows={4} dir="auto" className="input" placeholder={"5 | Rim | أحلى عيادة\n2 | Sam | انتظرت ساعة"} />
        <button className="btn-gold">{t.cl.draftReplies}</button>
      </form>
      {!rows.length && <p className="card text-muted">{t.cl.noReviews}</p>}
      {rows.map((r) => (
        <form key={r.id} action={approveReviewAction} className="card space-y-2 text-sm">
          {hidden}<input type="hidden" name="reviewId" value={r.id} />
          <div className="flex flex-wrap items-center gap-2">
            {r.rating != null && <span className="chip bg-gold text-gold-ink" dir="ltr">{"★".repeat(Math.max(0, Math.min(5, r.rating)))}</span>}
            <b dir="auto">{r.author}</b>
            <span className="chip bg-ink-3 text-muted" dir="ltr">{r.status}</span>
          </div>
          <p className="bidi">“{r.text}”</p>
          {r.reply ? (
            <>
              <textarea name="reply" rows={3} dir="auto" className="input" defaultValue={r.reply} />
              <div className="flex gap-2"><button className="btn-ghost px-3 py-1.5 text-xs">{t.cl.approve}</button><CopyButton text={r.reply} label={t.copy} done={t.copied} /></div>
            </>
          ) : <p className="text-xs text-muted">…</p>}
        </form>
      ))}
      {rows.some((r) => r.status === "new") && (
        <form action={clientJobAction}>{hidden}<input type="hidden" name="job" value="review-replies" /><input type="hidden" name="tab" value="reviews" /><button className="btn-ghost">{t.cl.draftReplies}</button></form>
      )}
    </div>
  );
}
