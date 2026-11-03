import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clients, db, eq, workspaces } from "@studio/db";
import { ChatWidget } from "@/components/ChatWidget";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Demo" };

/** Public, unlisted demo: the business owner chats with their own AI receptionist from their phone. */
export default async function DemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const [row] = await db
    .select({ name: clients.name, knowledge: clients.knowledge, status: clients.status, studio: workspaces.name })
    .from(clients).innerJoin(workspaces, eq(workspaces.id, clients.workspaceId)).where(eq(clients.demoToken, token));
  if (!row?.knowledge || row.status === "paused") notFound();
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-3">
      <p className="rounded-lg bg-ink-3 px-3 py-2 text-center text-xs text-muted">{t.cl.demoBanner}</p>
      <ChatWidget endpoint={`/api/demo/${token}`} title={row.name} subtitle={t.cl.chatSub} placeholder={t.cl.placeholder} send={t.cl.send} typing={t.cl.typing}
        handoffNote={t.cl.handoffNote} limitNote={t.cl.limitNote} suggestions={t.cl.suggestions} persistKey={`demo:${token}`} />
      <p className="text-center text-xs text-muted">{t.cl.demoFooter} {row.studio}</p>
    </main>
  );
}
