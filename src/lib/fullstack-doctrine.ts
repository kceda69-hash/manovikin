// MANOVIK FULL-STACK DOCTRINE
//
// A compact, high-signal build spec injected into the chat system prompt only
// when the user is actually asking for an app/site/feature to be built. Keeps
// ordinary chat cheap while making "build me X" answers ship-ready: complete
// frontend → backend code, a legendary (non-generic) UI, and a verifiable
// delivery order.
//
// Pure module — no I/O, no env, safe to import anywhere (client or server).

/** Cues that mean "produce real product code", not "explain something". */
const BUILD_HINTS =
  /\b(build|create|make|generate|scaffold|ship|develop|design|clone|rebuild|redesign|implement|convert)\b[\s\S]{0,80}\b(app|application|website|web ?site|web ?app|saas|platform|dashboard|landing ?page|portfolio|storefront|store|e-?commerce|marketplace|blog|crm|admin panel|booking|clone|full[- ]?stack|frontend|front-end|backend|back-end|ui|page|site)\b/i;

const STACK_HINTS =
  /\b(full[- ]?stack|frontend (and|\+|to) backend|end[- ]to[- ]end app|next\.?js|react|tanstack|tailwind|shadcn|supabase|postgres|prisma|drizzle|auth(entication)? flow|rest api|graphql|crud app)\b/i;

/** True when the prompt is a product-build request that deserves the doctrine. */
export function isFullStackBuildRequest(prompt: string): boolean {
  const p = (prompt ?? "").trim();
  if (p.length < 8) return false;
  return BUILD_HINTS.test(p) || STACK_HINTS.test(p);
}

/**
 * The doctrine itself. Written as directives (not prose) so models follow it
 * literally. Deliberately opinionated about aesthetics — generic AI-looking
 * output is the #1 failure mode of every competing agent.
 */
export const FULLSTACK_DOCTRINE = `

MANOVIK FULL-STACK BUILD DOCTRINE (apply whenever the user asks you to build an app, site, page, feature, or clone):

A. DELIVERY ORDER — always answer in this exact sequence, with headings:
1. Blueprint — one short paragraph: product, primary user, the single job the first screen does, and the stack you chose (default: React + TypeScript + Vite/TanStack Start, Tailwind + shadcn/ui, Postgres via Supabase, server functions for backend logic). One line on why.
2. Data model — every table with columns, types, keys, and relationships. Include the SQL: CREATE TABLE, GRANTs for the roles your policies allow, ENABLE ROW LEVEL SECURITY, then policies. Roles always live in a separate user_roles table, never on profiles.
3. Backend — server functions / API routes with full signatures, input validation (zod), authorization checks, error handling, and typed return shapes. No stubs.
4. Frontend — the design system first (tokens), then components, then pages/routes. Every file complete and importable.
5. Wiring — data fetching, mutations, optimistic updates, loading/empty/error states, and form validation.
6. Verification — exact commands to run, the click-path to test the happy path, and one edge case to try.
7. Next step — migration, env var, or deploy action.

B. LEGENDARY UI — non-negotiable craft rules:
- Commit to one distinctive visual direction and name it (e.g. "editorial brutalist", "warm archival", "kinetic neon-noir"). Never mix directions.
- BANNED unless the user explicitly asks: Inter/Poppins as the display face, purple→indigo gradient on white, centered hero + three feature cards + generic footer, stock "AI startup" wording, emoji as icons.
- Define semantic design tokens FIRST (CSS variables in the global stylesheet: background, foreground, primary, accent, muted, border, ring, radii, shadows, plus a type scale). Every component consumes tokens — never hardcode hex or text-white/bg-black. Dark mode falls out of the tokens.
- Typography carries the identity: pick a real display/body pairing, set a modular scale (e.g. 1.25), tune line-height and measure (60–75ch for prose), and use optical sizes for headings.
- Layout: use an intentional grid, asymmetry, and generous negative space. Vary section rhythm — never stack five identical card rows.
- Motion is purposeful and cheap: 150–250ms ease-out on transform/opacity only, staggered reveals, respect prefers-reduced-motion. No parallax soup.
- Depth via layered surfaces, hairline borders and soft directional shadows — not drop-shadow spam.
- Detail passes that separate legendary from generic: focus-visible rings, hover/active/disabled states on every control, skeletons instead of spinners, empty states with a real next action, tabular-nums for numeric columns, and consistent icon stroke weight.
- Responsive by construction: fluid type (clamp), container queries or sensible breakpoints, 44px minimum tap targets, safe-area padding on mobile.
- Accessibility is part of the design: one <h1> per page, semantic landmarks, labelled icon-only buttons, alt text, AA contrast, keyboard-operable everything.

C. BACKEND CRAFT:
- Validate every input at the boundary with zod; never trust the client.
- Authorize before you act — check the caller's identity and role inside the handler, not just in the UI route guard.
- Secrets stay server-side; read env inside the handler, never at module scope, never with a client-visible prefix.
- Every table gets RLS plus explicit GRANTs; a table without policies is a locked table, a table without grants is unreachable.
- Return typed DTOs. Handle the failure path explicitly and log server-side without leaking provider errors to users.
- Index the columns you filter and sort on; avoid N+1 by batching or joining.

D. CODE QUALITY:
- Complete files only. No "// TODO", no "...rest unchanged", no pseudo-code.
- Small focused modules; one responsibility per file; shared types in one place.
- Name files and exports the way the framework expects so imports resolve first try.
- State the file path above every code block, in fenced blocks with the language tag.
- Before finishing, re-read your own output as a hostile reviewer: missing imports, type errors, unhandled async, missing states, broken responsive behaviour. Fix silently.`;

/** Convenience: returns the doctrine block when the prompt warrants it, else "". */
export function fullstackDoctrineFor(prompt: string): string {
  return isFullStackBuildRequest(prompt) ? FULLSTACK_DOCTRINE : "";
}
