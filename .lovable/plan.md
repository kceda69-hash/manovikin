## Goal

Ship a secure `/admin` area for MANOVIK, gated by an `admin` role AND a verified TOTP (2FA) factor. Include user search, subscription cancel, Razorpay refund, credit top-up/adjust, and audit log viewer.

## Step 1 — Database (one migration)

- Create enum `public.app_role` (`admin`, `moderator`, `user`).
- Create table `public.user_roles(id, user_id → auth.users, role app_role, created_at, unique(user_id, role))` — with GRANTs, RLS, and policies (users read own, only service_role writes).
- Security-definer function `public.has_role(_user_id uuid, _role app_role)` returning boolean.
- Seed: grant `admin` role to your account (I'll ask you which email is the owner before running).

## Step 2 — Enforce MFA at Supabase level

- Enable TOTP in auth config so any admin must enroll an authenticator app (Google Authenticator / 1Password / Authy).
- Client uses `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` — admin routes require `aal2` (verified 2FA in current session). Non-admins are unaffected.

## Step 3 — Protected route layout

- Add `src/routes/_authenticated/admin/route.tsx` — pathless layout that:
  1. Server-verifies caller has `admin` role via a `requireSupabaseAuth` server fn.
  2. Checks `aal2`; if not, forces MFA challenge inline before rendering children.
- All admin server fns use `.middleware([requireSupabaseAuth])` + explicit `has_role` check + `aal2` claim check. Never trust the client.

## Step 4 — Admin server functions (`src/lib/admin.functions.ts`)

Each verifies admin + aal2, writes to `audit_logs`:

- `adminSearchUsers({ query })` — search auth.users by email (via `supabaseAdmin.auth.admin.listUsers` + filter).
- `adminGetUserDetail({ userId })` — profile, purchases, credits, ledger.
- `adminCancelSubscription({ purchaseId })` — sets `metadata.auto_renew=false`, marks status.
- `adminRefundPayment({ paymentId, amount? })` — calls Razorpay `/payments/:id/refund`, updates `purchases.status='refunded'`.
- `adminAdjustCredits({ userId, delta, reason })` — calls `manovik_topup_credit` / `manovik_spend_credit`.
- `adminGrantRole({ userId, role })` / `adminRevokeRole` — owner-only (extra check).
- `adminListAuditLogs({ limit })`.

## Step 5 — Admin UI (`/admin`)

Single dashboard page with tabs:

- **Users**: search box → results table → click opens detail drawer (purchases, credits, actions: cancel sub, refund payment, adjust credits, grant/revoke role).
- **Purchases**: recent purchases with filters (status/plan).
- **Audit log**: recent admin actions.
- **Settings**: enroll/verify TOTP factor for own account.

## Step 6 — Header affordance

Show an "Admin" link in the header only when `has_role(admin)` is true (checked via a light server fn).

## Technical notes

- Uses existing `audit_logs`, `purchases`, `ai_balance` tables — no schema changes there.
- Refunds: Razorpay Basic auth with existing `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. Webhook already reconciles.
- MFA UX: if admin has no TOTP factor, `/admin` shows enrollment (QR + verify) before granting access. Cannot skip.
- Rate-limit admin refunds via existing throttle pattern (max N per 10 min).

## What I need from you

1. **Which email should be seeded as the initial `admin`?** (yours)
2. Confirm you want **TOTP (authenticator app)** as the 2FA method. Supabase also supports Phone/SMS but TOTP is stronger and free.

Once you confirm those two, I'll ship it in one go.
