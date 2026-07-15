import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

// Public, unauthenticated streaming demo endpoint that powers the landing-page
// PromptComposer. It is intentionally lightweight:
//   - No auth, no DB writes, no threads.
//   - Strict input validation + payload cap.
//   - In-memory per-IP rate limit (best-effort, per Worker isolate).
//   - Uses Lovable AI Gateway with a cheap, fast model.
//
// If you need persistence, tools, or auth-bound features, use /api/chat instead.

const MAX_PROMPT_CHARS = 2000;
const MAX_BODY_BYTES = 96 * 1024;
const RATE_LIMIT_PER_MIN = 8;

const buckets = new Map<string, number[]>();
function rateLimit(key: string, limit = RATE_LIMIT_PER_MIN) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const arr = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

const TARGET_LABEL: Record<string, string> = {
  web: "a production web app deployed to the edge",
  ios: "a native iOS app ready for TestFlight and the App Store",
  android: "a native Android app ready for Google Play internal testing",
};

// Whitelist of demo model ids. "Claude Fable 5" is a marketing alias mapped to
// the strongest available OpenAI reasoning model in the gateway catalog.
const MODEL_MAP: Record<string, string> = {
  // gpt-5.4 streams plain text on the chat path (reasoning-only gpt-5.5 can
  // return empty text through streamText without the Responses API).
  "Claude Fable 5": "openai/gpt-5.4",
  "GPT-5.5": "openai/gpt-5.4",
  "Gemini 3 Pro": "google/gemini-3.1-pro-preview",
  Auto: "google/gemini-3.5-flash",
};

function systemPrompt(target: string, modelLabel: string, connected: boolean) {
  const goal = TARGET_LABEL[target] ?? TARGET_LABEL.web;
  const brain = connected
    ? `Currently routed model: ${modelLabel} (Claude Fable 5 session — deeper reasoning enabled).`
    : `Currently routed model: ${modelLabel}.`;
  return `You are MANOVIK AI — an autonomous product engineer. This is a public landing-page demo, so keep the reply focused and under ~350 words.

The user wants to ship ${goal}. ${brain}

Reply with this exact markdown structure:

### Plan
3-5 concise bullets covering scope, key screens/endpoints, and the shipping target.

### Tech stack
Bullets naming concrete frameworks, DB, auth, and deploy target for a ${target} build.

### First milestones
Numbered list (max 5) the agent will execute first.

### Ship it
One sentence CTA telling the user to sign in to MANOVIK to run this build for real.

Rules:
- Never invent private APIs, secrets, or credentials.
- Never claim work has already been executed — this is a preview.
- Refuse unsafe requests (malware, unauthorized access, CSAM, weapons) with a brief decline.`;
}

function shipSystemPrompt(targets: string[], modelLabel: string, connected: boolean) {
  const brain = connected
    ? `${modelLabel} (Claude Fable 5 session — full packaging brain)`
    : modelLabel;
  const list = targets.length ? targets.join(", ") : "web";
  return `You are MANOVIK's release engineer. Generate the packaging deliverables to ship an app to: ${list}. Model: ${brain}.

Reply as concise markdown. For EACH selected target, include a section:

## <Target name>
One-line summary of what's included.

Then include the real files as fenced code blocks with a filename comment on the FIRST line inside the fence, e.g.:
\`\`\`json
// file: app.json
{ ... }
\`\`\`

Required deliverables per target:
- web: manifest.json (PWA), index.html <head> meta+og tags, robots.txt, vercel.json OR netlify.toml (pick one).
- ios: app.json (Expo/RN), Info.plist snippet with required usage strings, App Store listing copy (title <=30 chars, subtitle <=30, description ~600 chars, keywords), eas.json build profile.
- android: app.json, AndroidManifest.xml snippet with permissions + intent filters, Play Store listing copy (title <=30, short desc <=80, full desc ~600), eas.json (or fastlane snippet).

End with:

### Next steps
3 numbered steps: sign the artifact, upload to the store console, run a staged rollout.

Rules:
- Values should be real and coherent (use the provided app name, description, package id).
- Do not fabricate credentials, API keys, or team IDs — leave TODO placeholders where needed.
- Keep the whole reply under ~900 words.`;
}

function workspaceSystemPrompt(
  files: { path: string; content: string }[],
  modelLabel: string,
  connected: boolean,
) {
  const brain = connected
    ? `${modelLabel} (Claude Fable 5 session — multi-file tool loop enabled)`
    : modelLabel;
  const snapshot = files
    .map((f) => `\`\`\`\n// file: ${f.path}\n${f.content}\n\`\`\``)
    .join("\n\n");
  return `You are MANOVIK's in-browser coding agent. Model: ${brain}.

You are editing this small project. Current file snapshot:

${snapshot}

When the user asks for a change, reply with:

### Plan
2-4 short bullets describing the edits.

### Edits
For EACH file you change or create, emit ONE fenced code block whose FIRST line is exactly:
// file: <relative path>
Followed by the FULL new contents of that file (not a patch, not a diff).

Rules:
- Only include files you actually change or create. Skip untouched files.
- Keep paths relative and stable (match existing paths for edits).
- Never invent secrets. Never claim the change is deployed — MANOVIK will apply it.
- Keep the whole reply under ~700 words.`;
}

export const Route = createFileRoute("/api/public/demo-chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.LOVABLE_API_KEY ?? "";
        if (!apiKey && !process.env.MANOVIK_AI_BASE_URL) {
          return new Response("AI gateway not configured", { status: 500 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "anon";
        if (!rateLimit(`demo:${ip}`)) {
          return new Response("Rate limit exceeded — try again in a minute.", { status: 429 });
        }

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength && contentLength > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        let body: {
          prompt?: unknown;
          target?: unknown;
          targets?: unknown;
          model?: unknown;
          mode?: unknown;
          connected?: unknown;
          files?: unknown;
        };
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const target =
          typeof body.target === "string" && ["web", "ios", "android"].includes(body.target)
            ? body.target
            : "web";
        const modelLabel =
          typeof body.model === "string" && MODEL_MAP[body.model] ? body.model : "Auto";
        const mode =
          body.mode === "ship" ? "ship" : body.mode === "workspace" ? "workspace" : "plan";
        const connected = body.connected === true;
        const rawTargets = Array.isArray(body.targets) ? body.targets : [];
        const targets = rawTargets
          .filter((t): t is string => typeof t === "string")
          .filter((t) => ["web", "ios", "android"].includes(t));
        const rawFiles = Array.isArray(body.files) ? body.files : [];
        const files = rawFiles
          .filter(
            (f): f is { path: string; content: string } =>
              !!f &&
              typeof f === "object" &&
              typeof (f as { path?: unknown }).path === "string" &&
              typeof (f as { content?: unknown }).content === "string",
          )
          .slice(0, 12)
          .map((f) => ({ path: f.path.slice(0, 200), content: f.content.slice(0, 6000) }));

        if (!prompt) {
          return new Response("Prompt required", { status: 400 });
        }
        if (prompt.length > MAX_PROMPT_CHARS) {
          return new Response(`Prompt too long (max ${MAX_PROMPT_CHARS} chars)`, { status: 400 });
        }

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const system =
            mode === "ship"
              ? shipSystemPrompt(targets.length ? targets : [target], modelLabel, connected)
              : mode === "workspace"
                ? workspaceSystemPrompt(files, modelLabel, connected)
                : systemPrompt(target, modelLabel, connected);
          const result = streamText({
            model: gateway(MODEL_MAP[modelLabel]),
            system,
            prompt,
            temperature: mode === "plan" ? 0.5 : 0.3,
          });
          return result.toTextStreamResponse({
            headers: {
              "Cache-Control": "no-store",
              "X-Manovik-Demo": "1",
              "X-Manovik-Mode": mode,
            },
          });
        } catch (err) {
          const msg = String((err as Error)?.message ?? err);
          const status = /402|credit/i.test(msg) ? 402 : /429|rate/i.test(msg) ? 429 : 500;
          console.error("[demo-chat] stream failed", msg);
          return new Response(
            status === 402
              ? "MANOVIK is temporarily out of demo credits. Try again shortly."
              : status === 429
                ? "Too many requests — slow down and retry."
                : "MANOVIK could not reach the model right now.",
            { status },
          );
        }
      },
    },
  },
});
