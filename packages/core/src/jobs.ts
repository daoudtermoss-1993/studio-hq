import type { Job } from "@studio/db";
import { analyzeImport, approveReel, dailyRun, processRecording, renderAvatar, weeklyMeeting, writeReel } from "./pipeline";
import { auditOpportunity, designOpportunity, huntOpportunities } from "./opportunities";
import { huntProblems, qualifyProblem, solveProblem } from "./solutions";
import { ceoStrategy } from "./strategy";
import { analyzeViral, huntViral } from "./viral";

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
    case "render-avatar":
      return renderAvatar(p.reelId);
    case "hunt-viral":
      return huntViral(job.workspaceId!);
    case "analyze-viral":
      return analyzeViral(p.findId);
    case "strategy":
      return ceoStrategy(job.workspaceId!);
    case "hunt-problems":
      return huntProblems(job.workspaceId!);
    case "qualify-problem":
      return qualifyProblem(p.problemId);
    case "solve-problem":
      return solveProblem(p.problemId);
    case "hunt-opportunities":
      return huntOpportunities(job.workspaceId!, { vertical: p.vertical, city: p.city, limit: p.limit });
    case "audit-site":
      return auditOpportunity(p.problemId);
    case "design-site":
      return designOpportunity(p.problemId);
    default:
      throw new Error(`unknown job type ${job.type}`);
  }
}
