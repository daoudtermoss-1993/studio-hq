import { notFound } from "next/navigation";
import { and, db, eq, reels } from "@studio/db";
import { Teleprompter } from "@/components/Teleprompter";
import { currentWorkspace } from "@/lib/auth";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Teleprompter" };

export default async function TeleprompterPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const [{ workspace }, { t }] = await Promise.all([currentWorkspace(), getT()]);
  const [reel] = await db.select().from(reels).where(and(eq(reels.workspaceId, workspace.id), eq(reels.number, Number(number) || -1)));
  if (!reel?.teleprompter) notFound();
  return <Teleprompter text={reel.teleprompter} labels={{ play: t.play, pause: t.pause, faster: t.faster, slower: t.slower, mirror: t.mirror, restart: t.restart }} />;
}
