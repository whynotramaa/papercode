import { loadSettings } from "./config/settings.js";
import { getProvider } from "./config/auth.js";
import { createClient, describeError } from "./providers/client.js";
import { detectCompat } from "./providers/compat.js";
import { runTurn } from "./agent/loop.js";
import { buildSystemPrompt } from "./agent/systemPrompt.js";
import { withImages } from "./agent/images.js";
import { executeTool, isReadOnlyTool, registerTools, toolDefinitions } from "./tools/index.js";
import { closeMcp, connectMcp } from "./tools/mcp.js";
import type { ChatMessage } from "./agent/messages.js";
import { createHistory } from "./agent/history.js";
import { refreshCatalog } from "./providers/catalog.js";

export async function runHeadless(prompt: string, opts: { json: boolean; yes: boolean }): Promise<number> {
  const settings = loadSettings();
  const provider = settings.activeProvider ? getProvider(settings.activeProvider) : undefined;
  const model = settings.activeModel;
  if (!provider || !model) {
    console.error("No model selected. Run papercode and use /connect first.");
    return 1;
  }

  const cwd = process.cwd();
  await refreshCatalog();
  const history = createHistory();
  const mcp = await connectMcp(cwd);
  registerTools(mcp.tools);
  for (const error of mcp.errors) console.error(error);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(cwd) },
    { role: "user", content: withImages(prompt, cwd) } as ChatMessage,
  ];
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  const emit = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`);

  let code = 0;
  try {
    await runTurn({
      client: createClient(provider),
      model,
      compat: detectCompat(provider.baseURL, model),
      messages,
      context: { history },
      tools: toolDefinitions(),
      isParallelSafe: isReadOnlyTool,
      maxSteps: settings.maxSteps,
      thinking: settings.thinking,
      signal: controller.signal,
      executeTool: async (call) => {
        const result = await executeTool({
          name: call.function.name,
          rawArgs: call.function.arguments,
          mode: "build",
          ctx: { root: cwd, signal: controller.signal, readHistory: history.read },
          requestApproval: async (tool) =>
            opts.yes || tool.permission === "mutating" ? true : { denied: "Headless mode runs commands only with --yes." },
        });
        return { content: result.content, isError: Boolean(result.isError), display: result.display };
      },
      onEvent: (event) => {
        if (opts.json) return emit(event);
        if (event.type === "text") process.stdout.write(event.delta);
        if (event.type === "tool_start") process.stderr.write(`\n· ${event.name} ${JSON.stringify(event.args)}\n`);
        if (event.type === "turn_end" && event.reason !== "done") code = 1;
      },
    });
    if (!opts.json) process.stdout.write("\n");
  } catch (err) {
    if (opts.json) emit({ type: "error", message: describeError(err) });
    else console.error(describeError(err));
    code = 1;
  } finally {
    await closeMcp();
  }
  return code;
}
