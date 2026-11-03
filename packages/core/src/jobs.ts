import type { Job } from "@studio/db";
import { analyzeImport, approveReel, dailyRun, processRecording, weeklyMeeting, writeReel } from "./pipeline";

/** Executes one background job. Throwing makes the queue retry with backoff. */
export async function runJob(job: Job) {
  const p = (job.payload ?? {}) as Record<string, any>;
  switch (job.type) {
    case "bootstrap":
    case "daily-run":
      return dailyRun(job.workspaceId!);
    case "write-reel":
      return writeReel(p.reelId);
    case "process-recording":
      return processRecording(p.reelId, p.options ?? {});
    case "approve-reel":
      return approveReel(p.reelId, p.changes);
    case "weekly-meeting":
      return weeklyMeeting(job.workspaceId!);
    case "analyze-import":
      return analyzeImport(p.importId);
    default:
      throw new Error(`unknown job type ${job.type}`);
  }
}
