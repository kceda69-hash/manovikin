import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { MANO_CHAT_SYSTEM, MANO_MODEL_ID, MANO_VERSION, manoStreamChain } from "@/lib/mano/mano1";

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
  Auto: "google/gemini-3.7-flash",
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

// MANOVIK DNA modes — the unique brains that set MANOVIK apart from generic
// chat models. Each mode ships a specialized system prompt tuned for that
// task; the model itself is the same gateway model, but the reasoning frame
// is very different.
const DNA_MODES = ["build", "reverse", "clone", "brain", "ship-store"] as const;
type DnaMode = (typeof DNA_MODES)[number];

function dnaSystemPrompt(mode: DnaMode, target: string, modelLabel: string, connected: boolean) {
  const brain = connected ? `${modelLabel} (Claude Fable 5 session)` : modelLabel;
  const shared = `You are MANOVIK AI — an autonomous product engineer with unique specialized brains. Model: ${brain}. Never fabricate secrets. Refuse malware, unauthorized access, CSAM, or weapons requests. Keep replies under ~600 words.`;

  switch (mode) {
    case "reverse":
      return `${shared}

MODE: Reverse-Engineer Brain. The user pasted code, a URL, or described an existing product. Deconstruct it faithfully.

Reply as markdown:

### What it is
1-2 sentences naming the product/pattern.

### Architecture (reverse-engineered)
3-6 bullets: data model, key modules, control flow, external services, notable tricks.

### Rebuild plan for ${target}
Numbered steps to rebuild a clean, original version in a modern stack (no copyrighted assets, no verbatim proprietary code).

### Improvements MANOVIK would ship
2-4 bullets — where MANOVIK's version beats the original (perf, DX, security, cost).`;

    case "clone":
      return `${shared}

MODE: Clone-Exactly Brain. The user wants a faithful, mistake-free reimplementation of a described feature/app in their stack.

Reply as markdown:

### Spec lock-in
Bullet the exact behaviors, edge cases, and inputs/outputs to preserve.

### Files
Emit each file as a fenced code block whose FIRST line is exactly \`// file: <path>\` and the FULL contents follow. Target ${target}. Prefer TypeScript + modern frameworks.

### Parity tests
Emit one or two \`// file: __tests__/<name>.test.ts\` blocks that assert the spec is met — the tests are how MANOVIK proves parity.

### Ship
One line: sign in to MANOVIK to run these files and see them working.`;

    case "brain":
      return `${shared}

MODE: MANOVIK Brain (memory). This user has a persistent knowledge graph of their stack, style, and past work. Talk to them like you already know them.

Reply as markdown:

### What I remember about you
3-5 bullets INFERRED from their prompt (stack signals, seniority tells, taste). Be honest — call it "guess" when it's a guess.

### Applied to this request
The actual answer to their prompt, shaped by the above.

### What I'll remember next
1-2 bullets on new signals worth adding to their Brain.`;

    case "ship-store":
      return `${shared}

MODE: One-Click Ship. Assume 100% accuracy is the bar — never invent store metadata that would get rejected on review.

Reply as markdown with the exact deliverables for ${target}:

### Preflight
Checklist of what MANOVIK verified (icons, screenshots dims, permissions justified, privacy policy URL present, review contact set).

### Store artifacts
Fenced code blocks with \`// file: <path>\` first line (e.g. \`app.json\`, \`Info.plist\` snippet, \`AndroidManifest.xml\` snippet, listing copy under length limits).

### Live preview URL
One line describing the ephemeral preview URL MANOVIK would deploy for review.

### Submit
Numbered steps to push to the store (staged rollout).`;

    case "build":
    default:
      return systemPrompt(target, modelLabel, connected);
  }
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
          dnaMode?: unknown;
          customSystem?: unknown;
          spec?: unknown;
          repoUrl?: unknown;
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
          body.mode === "ship"
            ? "ship"
            : body.mode === "workspace"
              ? "workspace"
              : body.mode === "reverse-engineer"
                ? "reverse-engineer"
                : body.mode === "verify"
                  ? "verify"
                  : "plan";
        const dnaMode: DnaMode =
          typeof body.dnaMode === "string" && (DNA_MODES as readonly string[]).includes(body.dnaMode)
            ? (body.dnaMode as DnaMode)
            : "build";
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
        const customSystem =
          typeof body.customSystem === "string" && body.customSystem.trim().length > 0
            ? body.customSystem.trim().slice(0, 4000)
            : "";
        const spec = typeof body.spec === "string" ? body.spec.slice(0, 4000) : "";
        const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.slice(0, 400) : "";

        if (!prompt) {
          return new Response("Prompt required", { status: 400 });
        }
        if (prompt.length > MAX_PROMPT_CHARS) {
          return new Response(`Prompt too long (max ${MAX_PROMPT_CHARS} chars)`, { status: 400 });
        }

        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const brain = connected ? `${modelLabel} (Claude Fable 5 session)` : modelLabel;
          const baseSystem =
            mode === "ship"
              ? shipSystemPrompt(targets.length ? targets : [target], modelLabel, connected)
              : mode === "workspace"
                ? workspaceSystemPrompt(files, modelLabel, connected)
                : mode === "reverse-engineer"
                  ? `You are MANOVIK's Reverse-Engineering Brain. Model: ${brain}.

Input: ${repoUrl ? `Repository URL: ${repoUrl}\n` : ""}${files.length ? `Source snapshot (${files.length} files) is attached in the user prompt.\n` : ""}The user wants an actionable change plan BEFORE any code is written.

Reply as markdown with these exact sections in this order:

### 1. Extracted Requirements
Numbered functional requirements (max 10). One sentence each. Mark inferred vs stated.

### 2. Non-Functional Requirements
Bullets: perf, security, scale, compliance, i18n, a11y — only those actually implied.

### 3. Architecture Map
An ASCII tree of the system:
\`\`\`
app/
├── ui/        # frameworks, key components
├── api/       # routes, contracts
├── data/      # tables, stores, caches
└── infra/     # deploy, secrets, jobs
\`\`\`
Then 3-6 bullets naming the notable patterns/tricks used.

### 4. Risks & Gaps
Bullets of missing tests, security holes, dead code, tech debt — be specific.

### 5. Actionable Change Plan
Numbered steps (max 8), each: <verb> <scope> — <acceptance criterion>. Order by dependency.

### 6. First PR
One paragraph describing the smallest safe first PR MANOVIK would open, listing exact files touched.

Rules:
- Never emit implementation code in this reply — plan only.
- Never copy proprietary code verbatim; describe patterns instead.
- If input is thin, mark assumptions explicitly as "Assumption:".`
                  : mode === "verify"
                    ? `You are MANOVIK's Clone Verification Brain. Model: ${brain}.

You are given the ORIGINAL SPEC and the GENERATED FILES from a Clone-Exactly session. Your job is to score parity, NOT to rewrite code.

Original spec:
"""${spec || "(none provided — infer from files)"}"""

Generated files (${files.length}):
${files.map((f) => `- ${f.path} (${f.content.length} chars)`).join("\n") || "(none)"}

Reply as markdown:

### Parity Score
A single line: \`Overall: NN/100\` plus a one-sentence verdict.

### Requirements Matrix
A markdown table with columns: | # | Requirement | Status | Evidence |
Status is one of: ✅ Met · ⚠️ Partial · ❌ Missing. Evidence cites the file(s) that satisfy it, or "not found".

### Gaps
Bullets naming every missing/partial requirement with a concrete fix (file + change).

### Parity Test Plan
Emit 1-3 fenced code blocks whose FIRST line is exactly \`// file: __tests__/<name>.test.ts\`. Each test asserts one gap-prone behavior. Use vitest.

### Verdict
One paragraph: ship / hold / rework, with the single blocking issue if any.

Rules: never invent files that weren't provided. If evidence is ambiguous, mark ⚠️ Partial rather than ✅.`
                    : dnaMode !== "build"
                      ? dnaSystemPrompt(dnaMode, target, modelLabel, connected)
                      : systemPrompt(target, modelLabel, connected);
          // Custom system prompt override from DNA Prompt Editor — appended so
          // the base contract still enforces safety, then user overrides tone/shape.
          const system = customSystem
            ? `${MANO_CHAT_SYSTEM}\n\n${baseSystem}\n\n---\nUSER-OVERRIDE (from DNA Prompt Editor — obey unless it conflicts with safety rules above):\n${customSystem}`
            : `${MANO_CHAT_SYSTEM}\n\n${baseSystem}`;
          const result = streamText({
            // MANO 1.1 runs the public demo too — substrate is compute only.
            model: gateway(manoStreamChain(prompt)[0]!),
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
