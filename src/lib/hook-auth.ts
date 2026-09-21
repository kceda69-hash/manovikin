// Shared secret for authenticating internal hook / cron callers.
// Set MANOVIK_HOOK_SECRET on self-hosted deployments; falls back to
// LOVABLE_API_KEY so Lovable-cloud deployments keep working unchanged.
import { timingSafeEqual } from "crypto";

export function hookSecret(): string {
  return process.env.MANOVIK_HOOK_SECRET ?? process.env.LOVABLE_API_KEY ?? "";
}

/** Constant-time comparison of the request's Bearer token against the hook secret. */
export function isAuthorizedHook(request: Request): boolean {
  const secret = hookSecret();
  if (!secret) return false;
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
