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
  const got =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
