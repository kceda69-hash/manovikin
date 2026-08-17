import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Remove every Supabase auth artifact this origin may hold.
 *
 * A half-cleared session (e.g. an expired refresh token left in localStorage)
 * makes the next sign-in attempt fail repeatedly with "Invalid Refresh Token"
 * before the user ever sees the login form, so we purge defensively.
 */
export function purgeLocalAuthStorage() {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && (/^sb-.*-auth-token/.test(key) || key.startsWith("supabase.auth."))) {
          keys.push(key);
        }
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {
      /* storage unavailable — nothing to purge */
    }
  }
  try {
    window.sessionStorage.removeItem("manovik.auth.next");
  } catch {
    /* ignore */
  }
}

/**
 * Full sign-out: stop in-flight protected queries, revoke the refresh token
 * server-side when the network allows it, then clear all local auth state.
 * Never throws — a failed revoke must still end in a signed-out client.
 */
export async function signOutEverywhere(queryClient?: QueryClient) {
  if (queryClient) {
    try {
      await queryClient.cancelQueries();
    } catch {
      /* ignore */
    }
    queryClient.clear();
  }

  // `global` revokes all refresh tokens for the user on the auth server.
  let revoked = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    revoked = !error;
  } catch {
    revoked = false;
  }

  if (!revoked) {
    // Offline or already-invalid token: at minimum drop the local session.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
  }

  purgeLocalAuthStorage();
  return { revoked };
}

/**
 * Called on app start: if a stored session cannot be validated, wipe it so the
 * user gets a clean login instead of looping auth errors.
 */
export async function repairStaleSession() {
  if (typeof window === "undefined") return;
  // Never interfere with an in-flight OAuth/magic-link completion: the callback
  // page is mid-handshake and a defensive purge there kills the fresh session.
  if (/^\/auth\/callback/.test(window.location.pathname)) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { error } = await supabase.auth.getUser();
    // Only a genuine rejected-credentials answer means the stored session is
    // dead. Network blips / rate limits must NOT wipe a valid session.
    const status = (error as { status?: number } | null)?.status;
    const rejected =
      !!error &&
      (status === 400 ||
        status === 401 ||
        status === 403 ||
        /invalid refresh token|refresh token not found|jwt/i.test(error.message));
    if (rejected) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      purgeLocalAuthStorage();
    }
  } catch {
    /* network failure — keep the session, the user may just be offline */
  }
}
