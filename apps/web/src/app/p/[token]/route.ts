import { withConceptBanner } from "@studio/core";
import { db, eq, problems, workspaces } from "@studio/db";

export const dynamic = "force-dynamic";

/**
 * Unlisted concept preview the owner sends to a business. The HTML was written by a model, so it is served with a sandbox CSP
 * (opaque origin, no scripts, no forms), only Google Fonts allowed, never indexed, and always with the "concept" banner.
 */
const CSP = [
  "sandbox", "default-src 'none'", "style-src 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com",
  "img-src data:", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'",
].join("; ");

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ design: problems.design, studio: workspaces.name })
    .from(problems)
    .innerJoin(workspaces, eq(workspaces.id, problems.workspaceId))
    .where(eq(problems.previewToken, token));
  const html = row?.design?.html as string | undefined;
  if (!html) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  return new Response(withConceptBanner(html, row.studio, /lang=["']ar/i.test(html) ? "ar" : "en"), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
}
