import { officeState } from "@studio/core";
import { currentWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { workspace } = await currentWorkspace();
  return Response.json(await officeState(workspace.id), { headers: { "Cache-Control": "no-store" } });
}
