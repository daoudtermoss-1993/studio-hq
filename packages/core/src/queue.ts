import { and, db, eq, inArray, jobs, lt, sql, type Job } from "@studio/db";

export type JobType =
  | "bootstrap"
  | "daily-run"
  | "write-reel"
  | "process-recording"
  | "approve-reel"
  | "weekly-meeting"
  | "analyze-import";

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

/** Atomically claims the next due job (safe with many workers: FOR UPDATE SKIP LOCKED). */
export async function claimNext(): Promise<Job | null> {
  const res = await db.execute<{ id: string }>(sql`
    UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE id = (
      SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now()
      ORDER BY run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING id`);
  const id = res.rows[0]?.id;
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
