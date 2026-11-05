"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addInterview, createEngagement, enqueue, ownEngagement, recordPilotMetrics, setEngagementPrices, setEngagementStage, STAGES,
  updateEngagementFacts, updateOpportunity,
} from "@studio/core";
import type { EngagementStage } from "@studio/db";
import { currentWorkspace } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === "") return undefined;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const back = (id: string, tab = "") => revalidatePath(`/app/consulting/${id}${tab ? `?tab=${tab}` : ""}`, "page");

async function mine(f: FormData) {
  const { workspace } = await currentWorkspace();
  const e = await ownEngagement(workspace.id, str(f, "engagementId"));
  if (!e) throw new Error("not found");
  return e;
}

const facts = (f: FormData) => ({
  company: str(f, "company"), website: str(f, "website"), sector: str(f, "sector"), country: str(f, "country"), size: str(f, "size"),
  contactName: str(f, "contactName"), contactRole: str(f, "contactRole"), source: str(f, "source"), market: str(f, "market"),
  language: str(f, "language"), notes: str(f, "notes"),
});

export async function createEngagementAction(f: FormData) {
  const { workspace } = await currentWorkspace();
  const input = facts(f);
  if (!input.company) return;
  const e = await createEngagement(workspace.id, input);
  redirect(`/app/consulting/${e.id}`);
}

export async function updateFactsAction(f: FormData) {
  const e = await mine(f);
  const input = facts(f);
  await updateEngagementFacts(e.id, { ...input, company: input.company || e.company });
  back(e.id);
}

export async function rerunResearchAction(f: FormData) {
  const e = await mine(f);
  await enqueue("research-account", e.workspaceId, { engagementId: e.id }, { dedupeKey: `research:${e.id}` });
  back(e.id);
}

export async function stageAction(f: FormData) {
  const e = await mine(f);
  const stage = str(f, "stage") as EngagementStage;
  if (!STAGES.includes(stage)) return;
  await setEngagementStage(e.workspaceId, e.id, stage, num(f, "value") ?? null);
  back(e.id);
  revalidatePath("/app/consulting");
}

export async function addInterviewAction(f: FormData) {
  const e = await mine(f);
  await addInterview(e.id, { role: str(f, "role"), person: str(f, "person"), notes: str(f, "notes") });
  back(e.id, "interviews");
}

export async function mapOpportunitiesAction(f: FormData) {
  const e = await mine(f);
  await enqueue("map-opportunities", e.workspaceId, { engagementId: e.id }, { dedupeKey: `map:${e.id}` });
  back(e.id, "opportunities");
}

export async function opportunityAction(f: FormData) {
  const e = await mine(f);
  await updateOpportunity(e.id, str(f, "oppId"), {
    tasksPerMonth: num(f, "tasksPerMonth"), minutesSaved: num(f, "minutesSaved"), hourlyCost: num(f, "hourlyCost"),
    runningMonthly: num(f, "runningMonthly"), setupCost: num(f, "setupCost"), value: num(f, "value"), ease: num(f, "ease"), speed: num(f, "speed"),
    choose: str(f, "choose") === "1",
  });
  back(e.id, "opportunities");
}

export async function demoAction(f: FormData) {
  const e = await mine(f);
  await enqueue("build-demo", e.workspaceId, { engagementId: e.id }, { dedupeKey: `demo:${e.id}` });
  back(e.id, "opportunities");
}

export async function pricesAction(f: FormData) {
  const e = await mine(f);
  await setEngagementPrices(e.id, { assessment: str(f, "assessment"), pilot: str(f, "pilot"), retainer: str(f, "retainer") });
  back(e.id, "proposal");
}

export async function proposalAction(f: FormData) {
  const e = await mine(f);
  const kind = str(f, "kind") === "pilot" ? "pilot" : "assessment";
  await enqueue("write-proposal", e.workspaceId, { engagementId: e.id, kind }, { dedupeKey: `proposal:${kind}:${e.id}` });
  back(e.id, "proposal");
}

export async function planPilotAction(f: FormData) {
  const e = await mine(f);
  await enqueue("plan-pilot", e.workspaceId, { engagementId: e.id }, { dedupeKey: `pilot:${e.id}` });
  back(e.id, "pilot");
}

export async function metricsAction(f: FormData) {
  const e = await mine(f);
  const keys: string[] = (e.pilot?.metrics ?? []).map((m: { key: string }) => m.key);
  const val = (k: string) => {
    const v = str(f, k);
    if (v === "") return null;
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  await recordPilotMetrics(e.id, Object.fromEntries(keys.map((k) => [k, { baseline: val(`b_${k}`), current: val(`c_${k}`) }])));
  back(e.id, "pilot");
}

export async function pilotReportAction(f: FormData) {
  const e = await mine(f);
  await enqueue("pilot-report", e.workspaceId, { engagementId: e.id }, { dedupeKey: `report:${e.id}` });
  back(e.id, "pilot");
}
