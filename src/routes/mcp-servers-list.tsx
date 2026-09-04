import { createFileRoute, Link } from "@tanstack/react-router";

type Server = {
  name: string;
  pkg: string;
  what: string;
  transport: "stdio" | "http";
};

type Category = {
  id: string;
  title: string;
  blurb: string;
  servers: Server[];
};

const CATEGORIES: Category[] = [
  {
    id: "filesystem",
    title: "Filesystem & local files",
    blurb: "Scoped read/write access so an agent can actually edit your project.",
    servers: [
      {
        name: "Filesystem",
        pkg: "@modelcontextprotocol/server-filesystem",
        what: "Read, write and list files inside directories you explicitly allow.",
        transport: "stdio",
      },
      {
        name: "Git",
        pkg: "@modelcontextprotocol/server-git",
        what: "Status, diff, log, blame and branch operations on a local repository.",
        transport: "stdio",
      },
    ],
  },
  {
    id: "databases",
    title: "Databases",
    blurb: "Schema-aware querying, so the agent stops guessing your column names.",
    servers: [
      {
        name: "PostgreSQL",
        pkg: "@modelcontextprotocol/server-postgres",
        what: "Inspect schema and run read-only SQL against a Postgres connection string.",
        transport: "stdio",
      },
      {
        name: "SQLite",
        pkg: "@modelcontextprotocol/server-sqlite",
        what: "Query and explore a local SQLite database file.",
        transport: "stdio",
      },
    ],
  },
  {
    id: "web-apis",
    title: "Web & APIs",
    blurb: "Let the agent fetch live context instead of hallucinating documentation.",
    servers: [
      {
        name: "Fetch",
        pkg: "@modelcontextprotocol/server-fetch",
        what: "HTTP fetching with markdown conversion — good for docs and internal APIs.",
        transport: "stdio",
      },
      {
        name: "Puppeteer",
        pkg: "@modelcontextprotocol/server-puppeteer",
        what: "Headless browser automation: navigate, click, screenshot, scrape.",
        transport: "stdio",
      },
    ],
  },
  {
    id: "dev-workflow",
    title: "Developer workflow",
    blurb: "Issue trackers, memory and chat where the work actually happens.",
    servers: [
      {
        name: "GitHub",
        pkg: "@modelcontextprotocol/server-github",
        what: "Issues, pull requests, code search and file operations on GitHub repos.",
        transport: "stdio",
      },
      {
        name: "Slack",
        pkg: "@modelcontextprotocol/server-slack",
        what: "Read channels and post messages from an agent workflow.",
        transport: "stdio",
      },
      {
        name: "Memory",
        pkg: "@modelcontextprotocol/server-memory",
        what: "Persistent knowledge-graph memory across sessions.",
        transport: "stdio",
      },
    ],
  },
  {
    id: "hosted",
    title: "Hosted / remote MCP",
    blurb: "Servers you reach over HTTP instead of spawning locally.",
    servers: [
      {
        name: "MANOVIK MCP",
        pkg: "https://manovik.in/mcp",
        what: "MANO 1.1 reasoning, coding, writing, translation and supply-chain scanning as MCP tools inside Claude, ChatGPT or Cursor.",
        transport: "http",
      },
    ],
  },
];

const TOTAL = CATEGORIES.reduce((n, c) => n + c.servers.length, 0);

const TITLE = "MCP Servers List: Curated Directory for AI Agents";
const DESCRIPTION =
  "A categorized list of Model Context Protocol (MCP) servers for filesystems, databases, APIs and dev workflows — plus config you can copy into any MCP client.";
const URL = "https://manovik.in/mcp-servers-list";

export const Route = createFileRoute("/mcp-servers-list")({
  component: MCPServersList,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      {
        name: "keywords",
        content:
          "mcp servers list, model context protocol servers, mcp directory, mcp server examples, claude mcp servers, cursor mcp",
      },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "MCP servers list",
          description: DESCRIPTION,
          url: URL,
          numberOfItems: TOTAL,
          itemListElement: CATEGORIES.flatMap((c) => c.servers).map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: s.name,
            description: s.what,
          })),
        }),
      },
    ],
  }),
});

function MCPServersList() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-foreground">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:underline">
          Home
        </Link>{" "}
        / <span>MCP servers list</span>
      </nav>

      <h1 className="text-4xl font-bold tracking-tight mb-4">
        MCP servers list: a curated directory for AI agents
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        Model Context Protocol (MCP) is the open standard that lets an AI agent call real tools —
        your filesystem, your database, your APIs. Below are {TOTAL} servers worth wiring up first,
        grouped by what they do, with the exact package name and config shape for each. New to the
        protocol? Start with the{" "}
        <Link to="/blog/mcp-guide" className="underline">
          MCP guide
        </Link>
        .
      </p>

      <nav aria-label="Categories" className="mb-12 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:border-primary"
          >
            {c.title}
          </a>
        ))}
      </nav>

      {CATEGORIES.map((category) => (
        <section key={category.id} id={category.id} className="mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold mb-1">{category.title}</h2>
          <p className="text-muted-foreground mb-4">{category.blurb}</p>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{category.title} MCP servers</caption>
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Server
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    What it does
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Transport
                  </th>
                </tr>
              </thead>
              <tbody>
                {category.servers.map((server) => (
                  <tr key={server.pkg} className="border-t border-border align-top">
                    <th scope="row" className="px-4 py-3 font-medium">
                      {server.name}
                      <span className="mt-1 block break-all font-mono text-xs font-normal text-muted-foreground">
                        {server.pkg}
                      </span>
                    </th>
                    <td className="px-4 py-3 text-muted-foreground">{server.what}</td>
                    <td className="px-4 py-3 text-muted-foreground">{server.transport}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-3">How to add one</h2>
        <p className="text-muted-foreground mb-4">
          Almost every MCP client reads the same config shape. A stdio server is spawned as a child
          process; a hosted server is reached over HTTP.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <code>{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/projects"]
    },
    "manovik": {
      "url": "https://manovik.in/mcp"
    }
  }
}`}</code>
        </pre>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-3">Choosing safely</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Scope filesystem servers to a single project directory, never your home folder.</li>
          <li>Use read-only database credentials unless the agent genuinely needs writes.</li>
          <li>
            Treat an MCP server like a dependency: check who publishes it before letting it read
            your code.
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-border p-6">
        <h2 className="text-2xl font-semibold mb-2">Use MANOVIK as your MCP server</h2>
        <p className="text-muted-foreground mb-4">
          Point any MCP client at <code className="font-mono">https://manovik.in/mcp</code> and your
          assistant gains MANO 1.1 — planning, adversarial review and synthesis on every answer.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/connect"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Connect MANOVIK
          </Link>
          <Link
            to="/login"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Create a free account
          </Link>
        </div>
      </section>
    </main>
  );
}
