import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/mcp-guide")({
  component: MCPGuidePost,
  head: () => ({
    meta: [
      { title: "MCP Servers with MANOVIK — A Sovereign AI Guide" },
      {
        name: "description",
        content:
          "How to extend MANOVIK AI with Model Context Protocol (MCP) servers: run local MCP tools alongside a sovereign, self-hosted deployment.",
      },
      {
        name: "keywords",
        content:
          "MCP servers, Model Context Protocol, MANOVIK MCP, sovereign AI, local MCP, self-hosted MCP, AI agent tools, Cursor MCP alternative",
      },
      { property: "og:title", content: "MCP Servers with MANOVIK — A Sovereign AI Guide" },
      {
        property: "og:description",
        content:
          "Integrate Model Context Protocol servers with MANOVIK for private, extendable AI agents.",
      },
      { property: "og:url", content: "https://manovik.in/blog/mcp-guide" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MCP Servers with MANOVIK" },
      {
        name: "twitter:description",
        content: "A technical guide to Model Context Protocol on a sovereign MANOVIK deployment.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/blog/mcp-guide" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "MCP Servers with MANOVIK — A Sovereign AI Guide",
          description:
            "How to extend MANOVIK AI with Model Context Protocol (MCP) servers on a sovereign, self-hosted deployment.",
          author: { "@type": "Organization", name: "MANOVIK" },
          publisher: { "@type": "Organization", name: "MANOVIK" },
          mainEntityOfPage: "https://manovik.in/blog/mcp-guide",
        }),
      },
    ],
  }),
});

function MCPGuidePost() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>Blog</span> / <span>MCP guide</span>
      </nav>

      <article className="prose prose-invert max-w-none">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          MCP Servers with MANOVIK: Extend Your Sovereign AI with Local Tools
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          Model Context Protocol (MCP) is the open standard that lets AI agents talk to tools,
          files, and APIs on your machine. Paired with a sovereign MANOVIK deployment, MCP gives you
          an extendable AI agent that never leaks context to a third party.
        </p>

        <h2>What is the Model Context Protocol?</h2>
        <p>
          MCP is a JSON-RPC protocol that standardizes how AI agents discover and call external
          tools — filesystem access, databases, git, browser automation, internal APIs. Instead of
          each vendor shipping a proprietary plugin format, any MCP server works with any
          MCP-capable agent.
        </p>
        <p>
          For MANOVIK users, that means you can bolt on the same local tools power users run on
          Cursor or Claude Desktop — without giving up the sovereignty of a self-hosted deployment.
        </p>

        <h2>Why local MCP + sovereign MANOVIK is a big deal</h2>
        <ul>
          <li>
            <strong>Code never leaves your network.</strong> MCP servers run on localhost. MANOVIK
            can be self-hosted. The full loop — model, agent, tools — stays inside your perimeter.
          </li>
          <li>
            <strong>No vendor plugin marketplace tax.</strong> Any open-source MCP server drops in,
            no gatekeeper.
          </li>
          <li>
            <strong>Composable.</strong> Mix community MCP servers (git, postgres, filesystem) with
            internal ones you write in an afternoon.
          </li>
        </ul>

        <h2>Connecting an MCP server to MANOVIK</h2>
        <p>The basic shape of a MANOVIK MCP config entry:</p>
        <pre>
          <code>{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/projects"]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgres://localhost/mydb"]
    }
  }
}`}</code>
        </pre>
        <p>
          On startup MANOVIK spawns each server as a child process, reads its advertised tools, and
          exposes them to the agent. Tool calls stay on your machine — the model sees only the tool
          schema and results you allow.
        </p>

        <h2>MCP servers worth adding on day one</h2>
        <ul>
          <li>
            <strong>filesystem</strong> — scoped read/write over a project directory.
          </li>
          <li>
            <strong>git</strong> — diff, blame, log, branch operations.
          </li>
          <li>
            <strong>postgres / sqlite</strong> — schema-aware query execution.
          </li>
          <li>
            <strong>fetch</strong> — HTTP with allowlists for internal APIs.
          </li>
          <li>
            <strong>puppeteer / playwright</strong> — browser automation for scraping and QA.
          </li>
        </ul>

        <h2>Writing your own MCP server</h2>
        <p>
          The official SDKs (TypeScript, Python) let you ship a working server in ~50 lines: define
          a tool schema, implement the handler, register with <code>StdioServerTransport</code>.
          Point MANOVIK's config at the binary and it appears in the agent's toolbelt on the next
          restart.
        </p>

        <h2>Sovereign by default</h2>
        <p>
          The combination — <Link to="/">lifetime MANOVIK</Link> license,{" "}
          <Link to="/blog/self-hosting-ai-with-ollama">local models via Ollama</Link>, and MCP
          servers on localhost — is the fully sovereign AI stack. No subscription, no vendor lock,
          no code exfiltration. If you've been looking for an extendable{" "}
          <Link to="/vs-cursor">Cursor alternative</Link> without the marketplace tax, this is it.
        </p>

        <h2>Next steps</h2>
        <p>
          Read the <Link to="/setup">setup guide</Link> to install MANOVIK, then pick your first
          three tools from the curated <Link to="/mcp-servers-list">MCP servers list</Link>.
        </p>
      </article>
    </main>
  );
}
