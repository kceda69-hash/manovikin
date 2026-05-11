import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Attach the current Supabase access token as a Bearer header on all
// server-function calls so `requireSupabaseAuth` middleware can authenticate
// the request. Without this, createServerFn() calls return 401.
let fetchPatched = false;
function patchServerFnFetch() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url && url.includes("/_serverFn/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // fall through to unmodified fetch
    }
    return originalFetch(input, init);
  };
}

export const getRouter = () => {
  patchServerFnFetch();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
