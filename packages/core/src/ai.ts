import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "./env";
import { mockAgent } from "./mock";

export interface AgentCall<S extends z.ZodTypeAny> {
  agent: string;
  system: string;
  prompt: string;
  schema: S;
  tier?: "smart" | "fast";
  webSearch?: boolean;
  maxTokens?: number;
}

export interface AgentResult<T> {
  data: T;
  usage: { input: number; output: number };
}

let client: Anthropic | null = null;
function anthropic() {
  if (!env.anthropicKey) throw new Error("ANTHROPIC_API_KEY is missing (or set AI_PROVIDER=mock)");
  client ??= new Anthropic({ apiKey: env.anthropicKey });
  return client;
}

function jsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const s = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
  delete s.$schema;
  delete s.definitions;
  return s;
}

/**
 * Calls one agent and returns its validated structured output.
 * The model must answer through a single `submit` tool whose input schema is the zod schema;
 * with web search enabled it may search first (server tool), then submit.
 */
export async function callAgent<S extends z.ZodTypeAny>(call: AgentCall<S>): Promise<AgentResult<z.infer<S>>> {
  if (env.aiProvider === "mock") {
    const raw = mockAgent(call.agent, call.prompt);
    return { data: call.schema.parse(raw), usage: { input: 0, output: 0 } };
  }

  const model = call.tier === "fast" ? env.modelFast : env.modelSmart;
  const submit = {
    name: "submit",
    description: "Submit your final result. Call this exactly once when your work is complete.",
    input_schema: jsonSchema(call.schema),
  };
  const tools: any[] = [submit];
  if (call.webSearch) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 6 });

  const messages: any[] = [{ role: "user", content: call.prompt }];
  const usage = { input: 0, output: 0 };
  let forceSubmit = !call.webSearch;
  let lastError = "";

  for (let turn = 0; turn < 6; turn++) {
    const res: any = await anthropic().messages.create({
      model,
      max_tokens: call.maxTokens ?? 8000,
      system: call.system,
      messages,
      tools,
      tool_choice: forceSubmit ? { type: "tool", name: "submit" } : { type: "auto" },
    } as any);
    usage.input += res.usage?.input_tokens ?? 0;
    usage.output += res.usage?.output_tokens ?? 0;

    const use = (res.content as any[]).find((b) => b.type === "tool_use" && b.name === "submit");
    if (use) {
      const parsed = call.schema.safeParse(use.input);
      if (parsed.success) return { data: parsed.data, usage };
      lastError = parsed.error.message.slice(0, 2000);
      messages.push({ role: "assistant", content: res.content });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: use.id, is_error: true, content: `Invalid result, fix and submit again:\n${lastError}` }],
      });
      forceSubmit = true;
      continue;
    }

    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "pause_turn") continue; // long server-side search: let it resume
    messages.push({ role: "user", content: "Now call the submit tool with your final result." });
    forceSubmit = true;
  }
  throw new Error(`${call.agent}: no valid result after retries. ${lastError}`);
}
