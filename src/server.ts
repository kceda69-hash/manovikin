import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { stashServerEnv } from "./lib/server-env";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

function getWorkerEnv(request: Request, env: unknown): Record<string, unknown> | undefined {
  // 1. Direct param (when the runtime calls the entry directly)
  if (env && typeof env === "object") return env as Record<string, unknown>;
  // 2. Nitro's Cloudflare preset stashes env on globalThis in its fetch handler
  //    (its lazy service loader only forwards `req`, dropping `env`/`ctx`)
  const g = globalThis as Record<string, unknown>;
  if (g.__env__ && typeof g.__env__ === "object") {
    return g.__env__ as Record<string, unknown>;
  }
  // 3. Nitro's augmentReq attaches { env, context } to request.runtime.cloudflare
  const runtime = (request as unknown as Record<string, unknown> | undefined)?.runtime;
  const cf = (runtime as Record<string, unknown> | undefined)?.cloudflare;
  const envFromReq = (cf as Record<string, unknown> | undefined)?.env;
  if (envFromReq && typeof envFromReq === "object") {
    return envFromReq as Record<string, unknown>;
  }
  return undefined;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Cloudflare Workers don't populate process.env with secrets, but the app
    // reads process.env.* everywhere (Supabase keys, AI keys, etc.).
    // Mirror the worker's vars/secrets into process.env per request, and also
    // stash them on globalThis so server code can resolve them even if the
    // process.env mirror is unavailable (see src/lib/server-env.ts).
    const workerEnv = getWorkerEnv(request, env);
    if (workerEnv) {
      stashServerEnv(workerEnv);
      for (const [key, value] of Object.entries(workerEnv)) {
        if (typeof value === "string") {
          process.env[key] = value;
        }
      }
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
