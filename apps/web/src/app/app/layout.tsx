import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { LangToggle } from "@/components/LangToggle";
import { NavLinks } from "@/components/NavLinks";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ workspace, user }, { t, locale }] = await Promise.all([currentWorkspace(), getT()]);
  const nav = [
    ["/app", t.nav.home], ["/app/office", t.nav.office], ["/app/reels", t.nav.reels], ["/app/solutions", t.nav.solutions], ["/app/clients", t.cl.nav], ["/app/consulting", t.cs.nav], ["/app/viral", t.nav.viral],
    ["/app/strategy", t.nav.strategy], ["/app/ideas", t.nav.ideas],
    ["/app/calendar", t.nav.calendar], ["/app/meeting", t.nav.meeting], ["/app/insights", t.nav.insights], ["/app/connectors", t.nav.connectors], ["/app/settings", t.nav.settings],
  ] as [string, string][];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b-[3px] border-line bg-ink-2/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/app" className="font-display text-lg font-extrabold">{workspace.name}</Link>
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-coral px-1.5 py-1 font-pixel text-[8px] text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white [animation:blink_1s_steps(2)_infinite]" />LIVE
          </span>
          <div className="flex-1" />
          <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
          <LangToggle locale={locale} label={t.language} back="/app" />
          <form action={logout}><button className="btn-ghost px-3 py-1.5 text-xs">{t.logout}</button></form>
        </div>
        <NavLinks items={nav} />
      </header>
      <main className="mx-auto max-w-[1560px] p-4">{children}</main>
    </div>
  );
}
