# MANOVIK AI — sovereign self-host image
# Build: docker build -t manovik-ai .
# Run:   docker run -p 3000:3000 --env-file .env manovik-ai
#
# This image runs MANOVIK AI with no dependency on Lovable's cloud.
# It expects an OpenAI-compatible LLM endpoint (Ollama, vLLM, OpenAI, etc.)
# and a Postgres-backed Supabase instance you control.

FROM oven/bun:1.1 AS builder
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run build

FROM oven/bun:1.1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# TanStack Start emits a node-compatible server in .output/
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
