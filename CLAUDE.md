# Studio HQ — notes for Claude

SaaS where a team of AI agents runs a short-video content studio; the human records and approves.
Monorepo (pnpm): `apps/web` (Next.js 15), `apps/worker` (job runner), `packages/core` (agents + pipeline),
`packages/db` (Drizzle + Postgres). README has the architecture.

## Conventions
- All packages are ESM TypeScript, consumed as source (no build step) — web uses `transpilePackages`.
- DB changes: edit `packages/db/src/schema.ts`, then `pnpm db:generate` (creates SQL in `packages/db/migrations`) and `pnpm db:migrate`. Never edit generated migrations by hand.
- New agent: add it to `packages/core/src/agents.ts` (role + look), give it a zod output schema in `schemas.ts`,
  call it inside `runAgent(...)` + `ask(...)` in `pipeline.ts` so it appears in the office and earns XP,
  add a mock answer in `mock.ts`.
- Long work goes through the queue (`enqueue` in `queue.ts`, handled in `jobs.ts`), never inside a request.
- UI strings live in `apps/web/src/lib/i18n.ts` (ar + en). Arabic is the default and the layout is RTL:
  use logical Tailwind classes (`ms-`, `pe-`, `start-`), and `bidi` on user/AI text.
- Agents never post or DM on platforms; they draft. Keep it that way.

## Checks before pushing
- `pnpm -r typecheck`
- `pnpm test` (needs Postgres db `studio_test`, ffmpeg)
- `pnpm --filter @studio/web build`
