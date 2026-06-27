import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/self-hosting-ai-with-ollama")({
  component: SelfHostingOllamaPost,
  head: () => ({
    meta: [
      { title: "Self-Hosting AI Agents with Ollama and Docker — MANOVIK" },
      {
        name: "description",
        content:
          "Step-by-step guide to deploy MANOVIK AI on your own infrastructure with Docker and Ollama for a fully private, sovereign AI coding environment.",
      },
      { name: "keywords", content: "self-hosting AI, Ollama, sovereign AI, local AI coding, private AI agent, Docker AI" },
      { property: "og:title", content: "Self-Hosting AI Agents with Ollama and Docker" },
      {
        property: "og:description",
        content: "Deploy MANOVIK AI locally with Docker + Ollama for a private, sovereign coding agent.",
      },
      { property: "og:url", content: "https://manovik.in/blog/self-hosting-ai-with-ollama" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Self-Hosting AI Agents with Ollama" },
      { name: "twitter:description", content: "Deploy MANOVIK + Ollama locally for sovereign AI coding." },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/blog/self-hosting-ai-with-ollama" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Self-Hosting AI Agents with Ollama and Docker",
          description:
            "Step-by-step guide to deploy MANOVIK AI on your own infrastructure with Docker and Ollama.",
          author: { "@type": "Organization", name: "MANOVIK" },
          publisher: { "@type": "Organization", name: "MANOVIK" },
          mainEntityOfPage: "https://manovik.in/blog/self-hosting-ai-with-ollama",
        }),
      },
    ],
  }),
});

function SelfHostingOllamaPost() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">Home</Link> / <span>Blog</span> /{" "}
        <span>Self-hosting AI with Ollama</span>
      </nav>

      <article className="prose prose-invert max-w-none">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Self-Hosting AI Agents with Ollama and Docker
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          A practical, end-to-end guide for engineering teams who want a private, sovereign AI
          coding environment — no data leaves your network.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Why self-host?</h2>
        <p>
          Cloud AI providers see every keystroke, snippet, and prompt. For regulated industries
          (finance, healthcare, defense, government) or any team handling proprietary code,
          that's a non-starter. Self-hosting with <strong>Ollama</strong> + <strong>Docker</strong>{" "}
          gives you GPT-class coding assistance with zero outbound calls.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Prerequisites</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>A Linux host (or macOS / WSL2) with 16 GB+ RAM (32 GB recommended)</li>
          <li>NVIDIA GPU with 12 GB+ VRAM for 7B–13B models (optional but fast)</li>
          <li>Docker 24+ and Docker Compose</li>
          <li>50 GB free disk for model weights</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Step 1 — Install Ollama</h2>
        <pre className="rounded-lg bg-muted p-4 overflow-x-auto"><code>{`# One-line install on Linux/macOS
curl -fsSL https://ollama.com/install.sh | sh

# Verify
ollama --version`}</code></pre>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Step 2 — Pull a coding model</h2>
        <pre className="rounded-lg bg-muted p-4 overflow-x-auto"><code>{`# Strong general coder, ~4.7 GB
ollama pull qwen2.5-coder:7b

# Or a smaller/faster option
ollama pull deepseek-coder-v2:16b

# Run a quick sanity check
ollama run qwen2.5-coder:7b "Write a Python function to reverse a linked list"`}</code></pre>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Step 3 — Run Ollama in Docker</h2>
        <p>Create a <code>docker-compose.yml</code>:</p>
        <pre className="rounded-lg bg-muted p-4 overflow-x-auto"><code>{`services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped

volumes:
  ollama-data:`}</code></pre>

        <pre className="rounded-lg bg-muted p-4 overflow-x-auto"><code>{`docker compose up -d
docker exec -it $(docker ps -qf name=ollama) ollama pull qwen2.5-coder:7b`}</code></pre>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Step 4 — Point MANOVIK at your local Ollama</h2>
        <p>
          In MANOVIK's settings, choose <strong>Sovereign Mode</strong> and set the model endpoint:
        </p>
        <pre className="rounded-lg bg-muted p-4 overflow-x-auto"><code>{`MANOVIK_MODEL_PROVIDER=ollama
MANOVIK_MODEL_ENDPOINT=http://localhost:11434
MANOVIK_MODEL_NAME=qwen2.5-coder:7b`}</code></pre>

        <p>
          Restart MANOVIK. Every prompt now routes to your local Ollama process — nothing leaves
          your machine.
        </p>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Step 5 — Verify it's fully offline</h2>
        <pre className="rounded-lg bg-muted p-4 overflow-x-auto"><code>{`# Block outbound while testing
sudo iptables -A OUTPUT -p tcp --dport 443 -j REJECT
# Use MANOVIK normally; if it still works, you're sovereign.
sudo iptables -D OUTPUT -p tcp --dport 443 -j REJECT`}</code></pre>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Production tips</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Front Ollama with a reverse proxy (Caddy / Traefik) for TLS inside the LAN.</li>
          <li>Use <code>OLLAMA_NUM_PARALLEL=4</code> to serve multiple developers at once.</li>
          <li>Mount the <code>ollama-data</code> volume on fast NVMe — model load time dominates cold starts.</li>
          <li>For 30B+ models, pin to a dedicated GPU node and use <code>OLLAMA_KEEP_ALIVE=-1</code>.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-10 mb-3">Next steps</h2>
        <p>
          You now have a fully sovereign AI coding agent. Pair it with MANOVIK's per-language
          memory and self-update scheduler for an offline assistant that gets smarter without
          ever phoning home.{" "}
          <Link to="/vs-cursor" className="underline">
            See how this compares to Cursor AI →
          </Link>
        </p>
      </article>
    </main>
  );
}
