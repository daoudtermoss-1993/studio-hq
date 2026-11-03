import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { latestArtifact, settingsOf, waConfigured } from "@studio/core";
import { and, clients, db, eq } from "@studio/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CopyButton } from "@/components/CopyButton";
import { ClientAssistant } from "@/components/client/Assistant";
import { ClientBookings } from "@/components/client/Bookings";
import { ClientGrowth } from "@/components/client/Growth";
import { ClientInbox } from "@/components/client/Inbox";
import { ClientKnowledge } from "@/components/client/Knowledge";
import { ClientReport } from "@/components/client/Report";
import { ClientReviews } from "@/components/client/Reviews";
import { ClientSettings } from "@/components/client/Settings";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const TABS = ["assistant", "inbox", "knowledge", "bookings", "reviews", "growth", "report", "settings"] as const;
type Tab = (typeof TABS)[number];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; conv?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [{ workspace }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const [c] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.workspaceId, workspace.id)));
  if (!c) notFound();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "assistant";
  const s = settingsOf(c);
  const ev = (await latestArtifact(c.id, "evaluation"))?.data;
  const demoUrl = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/a/${c.demoToken}`;
  const qr = await QRCode.toDataURL(demoUrl, { margin: 1, width: 240, color: { dark: "#0e1430", light: "#ffffff" } });
  const building = !c.knowledge || (!ev && Boolean(c.knowledge));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {building && <AutoRefresh every={4000} />}
      <Link href="/app/clients" className="text-sm text-muted hover:underline">← {t.cl.title}</Link>
      <header className="card grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${c.status === "active" ? "bg-ok text-ink" : c.status === "paused" ? "bg-ink-3 text-muted" : "bg-gold text-gold-ink"}`}>{t.cl.status[c.status]}</span>
            {ev && <span className={`chip ${ev.score / ev.total >= 0.9 ? "bg-ok text-ink" : "bg-coral text-white"}`}>{t.cl.evalScore}: <span dir="ltr">{ev.score}/{ev.total}</span></span>}
            <span className="chip bg-ink-3 text-text">{s.autoReply ? t.cl.mode.auto : t.cl.mode.draft}</span>
            <span className={`chip ${waConfigured(c) ? "bg-ok text-ink" : "bg-ink-3 text-muted"}`}>WhatsApp: {waConfigured(c) ? t.cl.waConnected : t.cl.waNotConnected}</span>
          </div>
          <h1 className="bidi font-display text-2xl font-extrabold">{c.name}</h1>
          <p className="text-sm text-muted" dir="auto">{[c.vertical, c.city, c.website, c.phone].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
            <span className="text-muted">{t.cl.demoLink}:</span>
            <a href={`/a/${c.demoToken}`} target="_blank" rel="noreferrer" className="break-all text-sky hover:underline" dir="ltr">{demoUrl}</a>
            <CopyButton text={demoUrl} label={t.copy} done={t.copied} />
          </div>
        </div>
        <figure className="text-center">
          <img src={qr} alt={t.cl.scanToTry} width={120} height={120} className="mx-auto rounded-lg bg-white p-1" />
          <figcaption className="mt-1 text-xs text-muted">{t.cl.scanToTry}</figcaption>
        </figure>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-ink-2 p-1">
        {TABS.map((k) => (
          <Link key={k} href={`/app/clients/${c.id}?tab=${k}`} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${tab === k ? "bg-gold font-bold text-gold-ink" : "text-muted hover:text-text"}`}>{t.cl.tabs[k]}</Link>
        ))}
      </nav>

      {tab === "assistant" && <ClientAssistant c={c} t={t} ev={ev} />}
      {tab === "inbox" && <ClientInbox c={c} t={t} convId={sp.conv} locale={locale} />}
      {tab === "knowledge" && <ClientKnowledge c={c} t={t} />}
      {tab === "bookings" && <ClientBookings c={c} t={t} locale={locale} />}
      {tab === "reviews" && <ClientReviews c={c} t={t} />}
      {tab === "growth" && <ClientGrowth c={c} t={t} />}
      {tab === "report" && <ClientReport c={c} t={t} />}
      {tab === "settings" && <ClientSettings c={c} t={t} />}
    </div>
  );
}
