// Server-side environment resolution that works on Cloudflare Workers.
//
// Cloudflare does not populate process.env with bindings the way Node does.
// src/server.ts mirrors worker vars/secrets into process.env (and a globalThis
// stash) per request, Nitro stashes them on globalThis.__env__, and Nitro's
// augmentReq attaches them to request.runtime.cloudflare.env. This helper
// checks every source so server functions never silently lose their config.
import { getRequest } from "@tanstack/react-start/server";

const STASH_KEY = "__manovik_env__";

/** Stash worker env on globalThis so any server code can find it later. */
export function stashServerEnv(env: Record<string, unknown>): void {
  const g = globalThis as Record<string, unknown>;
  const stash = ((g[STASH_KEY] as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") stash[key] = value;
  }
  g[STASH_KEY] = stash;
}

/** Resolve one server-side env var from every known source. */
export function getServerEnv(name: string): string | undefined {
  // 1. process.env — populated per request by the src/server.ts bridge.
  const fromProcess = (process.env as Record<string, string | undefined>)[name];
  if (fromProcess) return fromProcess;

  const g = globalThis as Record<string, unknown>;

  // 2. Our bridge's globalThis stash (set before the server entry runs).
  const stash = g[STASH_KEY] as Record<string, unknown> | undefined;
  if (stash && typeof stash[name] === "string") return stash[name] as string;

  // 3. Nitro's own stash of the Cloudflare bindings.
  const nitro = g.__env__ as Record<string, unknown> | undefined;
  if (nitro && typeof nitro[name] === "string") return nitro[name] as string;

  // 4. Nitro's request-attached Cloudflare env.
  try {
    const req = getRequest() as unknown as Record<string, unknown> | undefined;
    const runtime = req?.runtime as Record<string, unknown> | undefined;
    const cf = runtime?.cloudflare as Record<string, unknown> | undefined;
    const env = cf?.env as Record<string, unknown> | undefined;
    if (env && typeof env[name] === "string") return env[name] as string;
  } catch {
    // getRequest() throws outside a request scope — ignore.
  }

  return undefined;
}

/** Resolve several vars at once; returns the names of the missing ones. */
export function missingServerEnvs(names: string[]): string[] {
  return names.filter((n) => !getServerEnv(n));
}
