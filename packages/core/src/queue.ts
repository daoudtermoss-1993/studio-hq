import { and, db, eq, inArray, jobs, lt, sql, type Job } from "@studio/db";

export type JobType =
  | "bootstrap"
  | "daily-run"
  | "write-reel"
  | "process-recording"
  | "approve-reel"
  | "weekly-meeting"
  | "analyze-import"
  | "render-avatar"
  | "hunt-viral"
  | "analyze-viral"
  | "strategy"
  | "hunt-problems"
  | "qualify-problem"
  | "solve-problem"
  | "hunt-opportunities"
  | "audit-site"
  | "design-site"
  | "build-knowledge"
  | "receptionist-reply"
  | "evaluate-assistant"
  | "client-templates"
  | "review-replies"
  | "client-campaign"
  | "client-report"
  | "client-reminders";

/** Real-time jobs (a customer is waiting): never wait behind a workspace's long jobs, and get their own worker lane. */
export const FAST_JOBS: JobType[] = ["receptionist-reply"];

/**
 * Enqueue a background job.
 * dedupeKey: skip if a job with the same key is pending; with once=true, skip if it ever existed (cron).
 */
export async function enqueue(
  type: JobType,
  workspaceId: string | null,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; dedupeKey?: string; once?: boolean } = {},
): Promise<Job> {
  if (opts.dedupeKey) {
    const conds = [eq(jobs.type, type), eq(jobs.dedupeKey, opts.dedupeKey)];
    if (workspaceId) conds.push(eq(jobs.workspaceId, workspaceId));
    if (!opts.once) conds.push(inArray(jobs.status, ["queued", "running"]));
    const [existing] = await db.select().from(jobs).where(and(...conds)).limit(1);
    if (existing) return existing;
  }
  const [job] = await db
    .insert(jobs)
    .values({ type, workspaceId, payload, dedupeKey: opts.dedupeKey ?? null, runAt: opts.runAt ?? new Date() })
    .returning();
  return job;
}

/**
 * Atomically claims the next due job. Jobs of one workspace run one at a time (no races between
 * e.g. the daily run and an approval), different workspaces run in parallel. Claims are serialized
 * with a transaction-level advisory lock so two workers can't pick two jobs of the same workspace.
 * FAST_JOBS (customer replies) are exempt from that rule. lane: "fast" = only those, "normal" = everything else, default = any.
 */
export async function claimNext(opts: { lane?: "fast" | "normal" } = {}): Promise<Job | null> {
  const fast = sql.join(FAST_JOBS.map((t) => sql`${t}`), sql`, `);
  const laneCond = opts.lane === "fast" ? sql`AND j.type IN (${fast})` : opts.lane === "normal" ? sql`AND j.type NOT IN (${fast})` : sql``;
  const id = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(814207)`);
    const res = await tx.execute<{ id: string }>(sql`
      UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT j.id FROM jobs j
        WHERE j.status = 'queued' AND j.run_at <= now() ${laneCond}
          AND (j.workspace_id IS NULL OR j.type IN (${fast}) OR NOT EXISTS (
            SELECT 1 FROM jobs r WHERE r.status = 'running' AND r.workspace_id = j.workspace_id AND r.type NOT IN (${fast})))
        ORDER BY (j.type IN (${fast})) DESC, j.run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING id`);
    return res.rows[0]?.id;
  });
  if (!id) return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job ?? null;
}

export async function complete(job: Job) {
  await db.update(jobs).set({ status: "done", error: null }).where(eq(jobs.id, job.id));
}

export async function fail(job: Job, err: unknown) {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}`.slice(0, 4000) : String(err);
  const retry = job.attempts < job.maxAttempts;
  await db
    .update(jobs)
    .set(retry ? { status: "queued", error: message, runAt: new Date(Date.now() + 30_000 * 2 ** job.attempts) } : { status: "failed", error: message })
    .where(eq(jobs.id, job.id));
}

/** Jobs stuck in "running" (worker crashed) go back to the queue. */
export async function recoverStale(minutes = 30) {
  await db
    .update(jobs)
    .set({ status: "queued" })
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, new Date(Date.now() - minutes * 60_000))));
}
