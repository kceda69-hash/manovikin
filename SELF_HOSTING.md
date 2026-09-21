# MANOVIK AI — Sovereign Self-Hosting Guide

MANOVIK AI is **sovereign**: it can run entirely on your own infrastructure
with no dependency on Lovable's cloud, Lovable AI Gateway, or any managed
third-party service.

This guide explains how to deploy the full stack on your own server.

---

## What you control end-to-end

| Layer        | Default (sovereign)             | Swap to                                  |
| ------------ | ------------------------------- | ---------------------------------------- |
| Web app      | This repo, Dockerized           | Your own host (bare metal, k8s, VPS)     |
| AI inference | Ollama (`llama3.1`)             | vLLM, llama.cpp, OpenAI, OpenRouter, ... |
| Database     | Self-hosted Supabase + Postgres | Any Postgres + Supabase self-host        |
| Auth         | Supabase Auth (self-hosted)     | —                                        |
| Audit logs   | Your Postgres                   | —                                        |

No data leaves your network unless **you** point `MANOVIK_AI_BASE_URL` at a
remote provider.

---

## Quick start (single server, Docker)

```bash
git clone <this-repo> manovik
cd manovik
cp .env.example .env
# Edit .env — set a STRONG, UNIQUE POSTGRES_PASSWORD (compose refuses to
# start if it's empty) and your Supabase keys. Postgres (5432) and Ollama
# (11434) are bound to 127.0.0.1 only; do not republish them publicly.
docker compose up -d --build

# Pull a model into Ollama
docker compose exec ollama ollama pull llama3.1
```

Open `http://your-server:3000`.

---

## Environment variables

The app picks **sovereign mode** automatically when `MANOVIK_AI_BASE_URL` is
set. In sovereign mode `LOVABLE_API_KEY` is **not required**.

### AI provider (OpenAI-compatible)

| Var                   | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `MANOVIK_AI_BASE_URL` | Base URL of any OpenAI-compatible `/v1` API |
| `MANOVIK_AI_API_KEY`  | Bearer token for that endpoint              |
| `MANOVIK_AI_MODEL`    | Model name passed to the provider           |

### Database / auth (your Supabase)

| Var                             | Purpose                          |
| ------------------------------- | -------------------------------- |
| `SUPABASE_URL`                  | URL of your self-hosted Supabase |
| `SUPABASE_PUBLISHABLE_KEY`      | Anon/publishable key             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role (server-only)       |
| `VITE_SUPABASE_URL`             | Same URL, exposed to the client  |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same anon key, exposed to client |

---

## Database schema

Apply the SQL files in `supabase/migrations/` to your Postgres / self-hosted
Supabase instance — they create the `threads`, `messages`, `audit_logs`, and
`profiles` tables with RLS policies that scope every row to its owner.

```bash
psql "$DATABASE_URL" -f supabase/migrations/<each-file>.sql
```

---

## Hardening checklist

- [ ] Put MANOVIK behind HTTPS (Caddy / nginx / Traefik).
- [ ] Restrict Postgres and Ollama ports to the internal Docker network.
- [ ] Rotate `POSTGRES_PASSWORD` and Supabase JWT secrets.
- [ ] Back up the `manovik_pg` volume.
- [ ] Set `MANOVIK_AI_API_KEY` to a real secret if your inference server is
      reachable from outside the host.

---

## Switching providers without rebuilding

Edit `.env`, then:

```bash
docker compose up -d
```

Examples:

```bash
# Use OpenAI instead of local Ollama
MANOVIK_AI_BASE_URL=https://api.openai.com/v1
MANOVIK_AI_API_KEY=sk-...
MANOVIK_AI_MODEL=gpt-4o-mini

# Use vLLM on another machine
MANOVIK_AI_BASE_URL=http://10.0.0.5:8000/v1
MANOVIK_AI_API_KEY=any
MANOVIK_AI_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

MANOVIK AI is yours. No vendor lock-in.
