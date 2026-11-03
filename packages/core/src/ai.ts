import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "./env";
import { mockAgent } from "./mock";

export interface McpServer {
  name: string;
  url: string;
  token?: string | null;
}

export interface AgentCall<S extends z.ZodTypeAny> {
  agent: string;
  system: string;
  prompt: string;
  schema: S;
  tier?: "smart" | "fast";
  webSearch?: boolean;
  /** read full pages / PDFs the model found or was given */
  webFetch?: boolean;
  /** sandboxed Python/Bash (no internet) so engineers can run and test code */
  codeExecution?: boolean;
  /** remote MCP servers (connectors) this agent may use */
  mcp?: McpServer[];
  maxTokens?: number;
}

export const MCP_BETA = "mcp-client-2025-11-20";

/** Tool list + extra request fields for one call (exported for tests). */
export function buildTools(call: Pick<AgentCall<any>, "webSearch" | "webFetch" | "codeExecution" | "mcp"> & { submitSchema: Record<string, unknown> }) {
  const tools: any[] = [
    { name: "submit", description: "Submit your final result. Call this exactly once when your work is complete.", input_schema: call.submitSchema },
  ];
  if (call.webSearch) tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 6 });
  if (call.webFetch) tools.push({ type: "web_fetch_20250910", name: "web_fetch", max_uses: 8, max_content_tokens: 30000 });
  if (call.codeExecution) tools.push({ type: "code_execution_20250825", name: "code_execution" });
  const servers = (call.mcp ?? []).filter((m) => /^https:\/\//.test(m.url));
  for (const m of servers) tools.push({ type: "mcp_toolset", mcp_server_name: m.name });
  const extra: Record<string, unknown> = servers.length
    ? { mcp_servers: servers.map((m) => ({ type: "url", url: m.url, name: m.name, ...(m.token ? { authorization_token: m.token } : {}) })) }
    : {};
  const headers: Record<string, string> = servers.length ? { "anthropic-beta": MCP_BETA } : {};
  const hasExtraTools = tools.length > 1;
  return { tools, extra, headers, hasExtraTools };
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
  const { tools, extra, headers, hasExtraTools } = buildTools({ ...call, submitSchema: jsonSchema(call.schema) });

  const messages: any[] = [{ role: "user", content: call.prompt }];
  const usage = { input: 0, output: 0 };
  let forceSubmit = !hasExtraTools;
  let lastError = "";

  for (let turn = 0; turn < 10; turn++) {
    const res: any = await anthropic().messages.create(
      {
        model,
        max_tokens: call.maxTokens ?? (call.codeExecution ? 16000 : 8000),
        system: call.system,
        messages,
        tools,
        tool_choice: forceSubmit ? { type: "tool", name: "submit" } : { type: "auto" },
        ...extra,
      } as any,
      Object.keys(headers).length ? { headers } : undefined,
    );
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
