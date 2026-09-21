# MANOVIK — Self-hosting guide

Run the entire MANOVIK stack on your own machine with **zero cloud
dependencies**: the app, its database, Supabase Auth + REST API, and the LLM.

```
                  ┌─────────────┐
  browser ───────▶│   manovik   │ :3000   (the app)
                  └──────┬──────┘
                         │              ┌──────────┐
  browser ───────────────┼─────────────▶│   kong   │ :8000  (Supabase-compatible API)
  server code ───────────┘              └────┬─────┘
                                       ┌────┴────┐
                                       │  auth   │ GoTrue  :9999 (internal)
                                       │  rest   │ PostgREST     (internal)
                                       └────┬────┘
                                            │     ┌────────┐
                                            └────▶│postgres│ Supabase Postgres
                                                  └────────┘
                  ┌────────┐
                  │ ollama │ :11434 (localhost only, no auth)
                  └────────┘
```

**What's bundled:** Postgres (Supabase flavour), GoTrue (auth), PostgREST
(REST API), Kong (gateway), the MANOVIK app, Ollama.

**Deliberately skipped:** realtime, storage, Studio, imgproxy, analytics —
the app uses none of them (verified: no realtime channels, no storage
buckets; it only uses Supabase Auth + PostgREST table queries).

## Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose version`)
- ~4 GB RAM free, ~10 GB disk (Ollama models are large)
- Free ports: `3000` (app), `8000` (Supabase API), `5432`, `11434`
- `openssl` and `python3` (for the one-time key generation)

## First run

```bash
# 1. Configure
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD (URL-safe characters only)

# 2. Generate the Supabase signing keys (JWT secret + anon/service_role JWTs)
./scripts/gen-supabase-keys.sh >> .env

# 3. Start Postgres + Auth first — GoTrue creates the `auth` schema on boot,
#    which the migrations reference.
docker compose up -d postgres auth

# 4. Wait until both are healthy, then apply the 40 app migrations:
docker compose ps   # wait for "healthy"
for f in $(ls supabase/migrations/*.sql | sort); do
  docker compose exec -T postgres psql -U manovik -d manovik \
    -v ON_ERROR_STOP=1 -f - < "$f"
done

# 5. Start everything and pull the default LLM
docker compose up -d
docker compose exec ollama ollama pull llama3.1

# 6. Open the app and create your account
#    http://localhost:3000  → Sign up (auto-confirmed, no email needed)
```

Verify the API gateway directly:

```bash
curl -s http://localhost:8000/auth/v1/settings \
  -H "apikey: $(grep '^SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2)" | head -c 200
```

## Migration caveats (read before step 4)

- **Extensions.** The migrations need `pg_cron`, `pg_net`, `pgmq`,
  `supabase_vault`, and `vector`. These ship in the bundled
  `supabase/postgres` image — they do **not** exist in stock Postgres, which
  is why the compose file uses the Supabase image instead of
  `postgres:16-alpine`.
- **Order matters.** Several migrations reference `auth.users`. The `auth`
  schema is created by GoTrue on its first boot, so apply migrations only
  after `docker compose up -d postgres auth` is healthy (step 3).
- **Dead scheduled job.** Migration `20260711035849` registers a pg_cron job
  (`manovik-security-self-scan`) that POSTs to a dead Lovable Cloud URL.
  After migrating, either point it at your own app or remove it:
  ```sql
  SELECT cron.unschedule('manovik-security-self-scan');
  ```
  (run via `docker compose exec -T postgres psql -U manovik -d manovik`).
- **Vault secrets.** The migrations auto-generate secrets
  (`schedules_run_token`, etc.) inside the database Vault — nothing to do
  manually.
- **Old volume.** If you ran a previous version of this compose file with
  `postgres:16-alpine`, the `manovik_pg` volume is **incompatible** with the
  new PG15-based image. Back up anything you care about, then
  `docker compose down -v` before the first start.
- **Run as superuser.** The migrations use `CREATE EXTENSION` and
  `GRANT ... TO service_role`; the `manovik` DB user is a superuser, and the
  `service_role` role is created by the Supabase Postgres image. The psql
  loop above runs as that user — don't run migrations as `anon`.

## Creating the first user

Easiest: open `http://localhost:3000`, sign up with email + password.
`GOTRUE_MAILER_AUTOCONFIRM=true` (default) means no email server is needed —
the account works immediately.

Alternative (GoTrue admin API, needs the service-role key):

```bash
SR=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2)
curl -s -X POST http://localhost:8000/auth/v1/admin/users \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"choose-a-strong-password","email_confirm":true}'
```

## Switching back to Supabase Cloud

The app is not locked in. In `.env`, set:

```ini
SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...   # from the Cloud dashboard
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # from the Cloud dashboard
```

then rebuild the app (the `VITE_*` values are baked into the JS bundle at
build time):

```bash
docker compose up -d --build manovik
```

To stop the local Supabase services while keeping the app + Ollama:

```bash
docker compose stop postgres auth rest kong
```

## Production notes

- **TLS.** Kong's `:8000` is plain HTTP. Put a reverse proxy (Caddy, nginx,
  Traefik) with a real certificate in front for anything internet-facing,
  and set `SUPABASE_PUBLIC_URL` / `APP_PUBLIC_URL` / `VITE_SUPABASE_URL` to
  the public HTTPS URLs (then `--build manovik`).
- **Email.** Set `GOTRUE_MAILER_AUTOCONFIRM=false` and fill in the
  `GOTRUE_SMTP_*` vars for real confirmation / magic-link emails.
- **Google OAuth.** Set `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` plus client ID
  / secret; register `<SUPABASE_PUBLIC_URL>/auth/v1/callback` in Google Cloud
  Console.
- **Backups.** `docker compose exec -T postgres pg_dump -U manovik manovik > backup.sql`
- **Key rotation.** Changing `JWT_SECRET` invalidates every issued key and
  session — all users must sign in again.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `kong` exits / `config` errors about keys | Run `./scripts/gen-supabase-keys.sh >> .env` |
| `401`/*Invalid API key* from `/rest/v1` | `JWT_SECRET` changed after keys were generated — regenerate all three together |
| Migration fails on `auth.users` | GoTrue hadn't booted yet — `docker compose up -d postgres auth`, wait for healthy, retry |
| Migration fails on `pgmq` / `pg_cron` | Wrong Postgres image — must be `supabase/postgres`, not stock `postgres` |
| App shows old Supabase URL after `.env` change | `VITE_*` is baked at build time — `docker compose up -d --build manovik` |
| Port already in use | Change the left side of the `ports:` mapping (e.g. `"18000:8000"`) and update `VITE_SUPABASE_URL` / `SUPABASE_PUBLIC_URL` |
| `postgres` won't start after image switch | Old PG16 volume — `docker compose down -v` (destroys data) and start fresh |
