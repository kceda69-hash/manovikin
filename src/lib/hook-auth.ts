// Shared secret for authenticating internal hook / cron callers.
// Set MANOVIK_HOOK_SECRET as a worker secret (and on self-hosted deployments).
//
// FIX (agent-safety audit): the LOVABLE_API_KEY fallback was removed.
// LOVABLE_API_KEY is shared across deployments, so one deployment's key
// could authorize another deployment's hooks. Hooks now fail closed (403)
// when MANOVIK_HOOK_SECRET is not set, with a loud warning in the logs.
// The run-schedules route additionally accepts the per-database RPC cron
// token, which is unaffected by this change.
import { timingSafeEqual } from "crypto";
import { log } from "@/lib/logger";

export function hookSecret(): string {
  return process.env.MANOVIK_HOOK_SECRET ?? "";
}

/** Constant-time comparison of the request's Bearer token against the hook secret. */
export function isAuthorizedHook(request: Request): boolean {
  const secret = hookSecret();
  if (!secret) {
    log.warn("hook_auth_no_secret_configured", {});
    return false;
  }
  const got = bearerToken(request);
  if (!got) return false;
  return safeEqual(got, secret);
}

/** Extract the Bearer token from a request (empty string when absent). */
export function bearerToken(request: Request): string {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

/** Constant-time string equality (false on length mismatch). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Dual-auth for pg_cron-triggered hooks: accept MANOVIK_HOOK_SECRET or the
 * per-database RPC cron token (resolved by the caller via its vault-backed
 * get_*_token() function, e.g. get_fleet_tick_token()). Fails closed when
 * neither is configured or matches. This is what lets the fleet tick run on
 * schedule even when MANOVIK_HOOK_SECRET was never set.
 */
export function isAuthorizedHookOrCronToken(
  request: Request,
  cronToken: string | null,
): boolean {
  const got = bearerToken(request);
  if (!got) return false;
  const candidates = [hookSecret(), cronToken].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  return candidates.some((secret) => safeEqual(got, secret));
}
