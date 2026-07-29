import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sandbox } from "@/lib/agent-tools";
import { toolError } from "../ai-call";

export default defineTool({
  name: "manovik_run_tool",
  title: "Run a MANOVIK sandbox tool",
  description:
    "Execute one of MANOVIK's sandboxed utility tools: `math.eval` (arithmetic), `text.transform` (upper/lower/reverse/length/b64encode/b64decode), `time.now` (server time), `http.get` (allow-listed hosts only). Pass the tool name and its JSON arguments. Call with an empty name to list available tools.",
  inputSchema: {
    name: z
      .string()
      .trim()
      .max(60)
      .default("")
      .describe("Sandbox tool name, e.g. 'math.eval'. Empty string lists available tools."),
    args: z
      .record(z.string(), z.unknown())
      .default({})
      .describe("JSON arguments for the tool, e.g. { \"expression\": \"2 ** 10\" }."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ name, args }) => {
    try {
      const available = sandbox.list();
      if (!name) {
        return {
          content: [{ type: "text", text: JSON.stringify(available, null, 2) }],
          structuredContent: { tools: available },
        };
      }
      if (!sandbox.has(name)) {
        throw new Error(
          `Unknown tool "${name}". Available: ${available.map((t) => t.name).join(", ")}`,
        );
      }
      const result = await sandbox.run(name, args, "mcp:public");
      if (!result.ok) throw new Error(result.error ?? "Tool execution failed");
      return {
        content: [{ type: "text", text: JSON.stringify(result.output, null, 2) }],
        structuredContent: { tool: name, output: result.output, durationMs: result.durationMs },
      };
    } catch (err) {
      return toolError(err);
    }
  },
});
