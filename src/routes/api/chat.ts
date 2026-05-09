import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { redactMessage } from "@/lib/redact";

// Allow-list of tool/action capabilities the agent may perform.
// Any future tool calls must be checked against this set before execution.
const ALLOWED_TOOLS = new Set<string>([
  "text.respond",
  "code.generate",
  "markdown.render",
]);

function summarize(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg?.parts) return "";
  return msg.parts
    .map((p) => (p.type === "text" ? p.text ?? "" : `[${p.type}]`))
    .join(" ")
    .trim()
    .slice(0, 200);
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  entry: {
    user_id: string;
    thread_id: string | null;
    event_type: string;
    summary?: string;
    ip?: string;
    user_agent?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await (supabase.from("audit_logs" as never) as any).insert({
    user_id: entry.user_id,
    thread_id: entry.thread_id,
    event_type: entry.event_type,
    summary: entry.summary ?? null,
    ip: entry.ip ?? null,
    user_agent: entry.user_agent ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error("[audit] insert failed:", error.message);
}

const SYSTEM_PROMPT = `You are NOVA-X, an elite autonomous AI agent built to act like a senior engineering employee. You can:
- Write production-quality code in any programming language (TypeScript, Python, Rust, Go, Swift, Kotlin, C++, SQL, etc.)
- Architect websites, mobile apps, APIs, microservices, and full-stack systems
- Debug, refactor, optimize, and review code
- Explain concepts clearly with markdown, code blocks, and step-by-step reasoning
- Help with strategy, planning, content, analysis, and problem-solving

Style: precise, confident, futuristic. Use markdown. Use fenced code blocks with language tags. When asked to build something complex, break it into clear phases.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claimsData.claims.sub as string;

        const body = (await request.json()) as { messages: UIMessage[]; threadId: string };
        const { messages, threadId } = body;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Bad request", { status: 400 });
        }

        // Verify thread ownership
        const { data: thread, error: tErr } = await supabase
          .from("threads")
          .select("id,user_id,title")
          .eq("id", threadId)
          .maybeSingle();
        if (tErr || !thread || thread.user_id !== userId) {
          return new Response("Thread not found", { status: 404 });
        }

        // Save the latest user message
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        if (lastUserMsg) {
          const { error: insertErr } = await supabase.from("messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            message: lastUserMsg as unknown as Record<string, unknown>,
          });
          if (insertErr) console.error("[chat] save user msg:", insertErr);

          // Auto-title if still default
          if (thread.title === "New conversation") {
            const text = lastUserMsg.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim()
              .slice(0, 60);
            if (text) {
              await supabase
                .from("threads")
                .update({ title: text, updated_at: new Date().toISOString() })
                .eq("id", threadId);
            }
          }
        }

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");

        try {
          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ messages: finalMessages }) => {
              const lastAssistant = [...finalMessages].reverse().find((m) => m.role === "assistant");
              if (!lastAssistant) return;
              const { error } = await supabase.from("messages").insert({
                thread_id: threadId,
                user_id: userId,
                role: "assistant",
                message: lastAssistant as unknown as Record<string, unknown>,
              });
              if (error) console.error("[chat] save assistant msg:", error);
              await supabase
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
            },
          });
        } catch (err) {
          console.error("[chat] stream error:", err);
          return new Response("AI gateway error", { status: 500 });
        }
      },
    },
  },
});
