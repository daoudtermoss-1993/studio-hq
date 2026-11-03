import { claimNext, complete, enqueue, fail, localDate, recoverStale, runJob, zonedParts } from "@studio/core";
import { brandProfiles, db } from "@studio/db";

const POLL_MS = Number(process.env.WORKER_POLL_MS || 1500);
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const DAILY_AT = process.env.DAILY_RUN_AT || "07:30";
const WEEKLY_AT = process.env.WEEKLY_MEETING_AT || "10:00"; // Sundays, brand timezone

let stopping = false;
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function loop(slot: number) {
  while (!stopping) {
    const job = await claimNext().catch((e) => {
      log("claim error", e);
      return null;
    });
    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    const t = Date.now();
    log(`[${slot}] ▶ ${job.type} ${job.id}`);
    try {
      await runJob(job);
      await complete(job);
      log(`[${slot}] ✔ ${job.type} ${((Date.now() - t) / 1000).toFixed(1)}s`);
    } catch (err) {
      log(`[${slot}] ✖ ${job.type}`, err instanceof Error ? err.message : err);
      await fail(job, err);
    }
  }
}

/** Every minute: enqueue the daily run (07:30) and the Sunday meeting (10:00) in each brand's timezone. */
async function scheduler() {
  while (!stopping) {
    try {
      await recoverStale();
      const brands = await db.select({ workspaceId: brandProfiles.workspaceId, timezone: brandProfiles.timezone }).from(brandProfiles);
      for (const b of brands) {
        const now = zonedParts(new Date(), b.timezone);
        const today = localDate(b.timezone);
        if (now.time >= DAILY_AT) {
          await enqueue("daily-run", b.workspaceId, {}, { dedupeKey: `daily:${today}`, once: true });
        }
        if (now.weekday === "Sun" && now.time >= WEEKLY_AT) {
          await enqueue("weekly-meeting", b.workspaceId, {}, { dedupeKey: `weekly:${today}`, once: true });
        }
      }
    } catch (e) {
      log("scheduler error", e);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log("stopping…");
    stopping = true;
    setTimeout(() => process.exit(0), 5000).unref();
  });
}

log(`worker up: concurrency ${CONCURRENCY}, daily ${DAILY_AT}, weekly Sun ${WEEKLY_AT}`);
void scheduler();
for (let i = 0; i < CONCURRENCY; i++) void loop(i + 1);
