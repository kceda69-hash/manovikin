---
name: admin-endpoint-hardening
description: How to add or modify admin-only server functions in this MANOVIK project so every endpoint is uniformly role-checked, 2FA-gated (AAL2), and leaks no information on denial. Use whenever writing a `createServerFn` that reads or mutates admin-only data (admin dashboard, SEO tools, audit log, moderation, backfills).
---

# Admin endpoint hardening

Every admin-only server function in this project MUST route through the shared guard at `src/lib/admin-guard.ts`. Do not re-implement role checks inline, do not read `process.env.ADMIN_EMAIL`, and do not return distinct error codes/messages for the different failure reasons — that leaks whether the caller is signed in, is an admin, or is missing 2FA.

## The guard

`assertAdmin(context)` from `src/lib/admin-guard.ts` enforces, in order:

1. Authenticated session (context provided by `requireSupabaseAuth`)
2. `claims.aal === "aal2"` (TOTP verified this session)
3. `public.has_role(user_id, 'admin')` returns true

Any failure throws `new Response("Not Found", { status: 404 })` — identical body/status for every denial. A single `console.warn` records the reason server-side; never surface that reason to the client.

## Canonical shape

```ts
// src/lib/<feature>.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard";

export const adminDoThing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = await assertAdmin(context); // throws 404 on any denial
    // ... privileged work using context.supabase (RLS as the admin user)
    // or, if you need to bypass RLS:
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // ... service-role work
    return { ok: true, actor: userId };
  });
```

## Rules

- **Always** chain `.middleware([requireSupabaseAuth])` before `.handler`. Without it, `context.userId`/`context.claims` are undefined and `assertAdmin` denies as `no-context` (still safe, but the endpoint would be effectively public otherwise).
- **Never** early-return a JSON error like `{ error: "forbidden" }` — throw via `assertAdmin` (or re-throw the 404 Response). Distinct errors = information leak.
- **Never** check `claims.email === process.env.ADMIN_EMAIL`. Role lives in `public.user_roles`; use `has_role`. Old email-based checks were removed for a reason.
- **Never** read `context.userId` before calling `assertAdmin` and branch on it — do the guard first, then use its return value (`{ userId, email }`).
- Client middleware `attachSupabaseAuth` in `src/start.ts` must remain registered, otherwise every admin call fails with 401 before reaching the guard.
- Admin routes (`src/routes/admin.tsx`, `src/routes/audit.tsx`, `src/routes/seo.tsx`) call these functions from components via `useServerFn` — never from a public route loader (SSR prerender has no session → build fails with `Unauthorized`).

## Testing a new admin endpoint

1. Call it signed-out → 404.
2. Call it signed-in as a non-admin → 404.
3. Call it as admin without completing TOTP this session (AAL1) → 404.
4. Call it as admin with AAL2 → success.

All four responses (1–3) must be byte-identical. If they differ, the guard is being bypassed.

## Related files

- `src/lib/admin-guard.ts` — the guard itself; do not fork.
- `src/lib/admin.functions.ts` — reference implementation.
- `src/lib/seo.functions.ts` — reference implementation across multiple endpoints.
- `src/integrations/supabase/auth-middleware.ts` — provides `context.supabase / userId / claims`.
- `supabase/migrations/*has_role*` — `has_role` is `SECURITY INVOKER`; `authenticated` has `SELECT` on `user_roles` so RLS via `has_role` works under the caller's role.
