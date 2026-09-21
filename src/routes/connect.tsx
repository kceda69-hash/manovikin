import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect MANOVIK to ChatGPT & Claude — Agent Integrations" },
      {
        name: "description",
        content:
          "Connect ChatGPT, Claude, and other AI assistants to MANOVIK using MCP. Copy the server URL and follow the step-by-step guide.",
      },
      { property: "og:title", content: "Connect MANOVIK to your AI assistant" },
      {
        property: "og:description",
        content: "Step-by-step instructions to connect ChatGPT or Claude to MANOVIK via MCP.",
      },
      { property: "og:url", content: "https://manovik.in/connect" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/connect" }],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const [mcpUrl, setMcpUrl] = useState("https://manovik.in/mcp");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setMcpUrl(new URL("/mcp", window.location.origin).toString());
    }
  }, []);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    toast.success("MCP URL copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Connect your AI assistant to MANOVIK
          </h1>
          <p className="mt-3 text-muted-foreground">
            Paste this URL into ChatGPT or Claude and your assistant can use MANOVIK's full brain —
            ask anything, generate and debug production code with the Quantum Engineering Protocol,
            reverse-engineer software, run sandboxed tools, and look up MANOVIK pricing, posts and
            pages.
          </p>
        </div>

        <Card className="mb-10 border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MCP server URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-sm">
                {mcpUrl}
              </code>
              <Button onClick={copyUrl} className="shrink-0">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copy URL
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ChatGPT</CardTitle>
              <CardDescription>Connect via Developer mode</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-foreground">
                <li>
                  1. Open{" "}
                  <a
                    className="text-primary underline underline-offset-2"
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ChatGPT Connector settings
                  </a>{" "}
                  and enable <strong>Developer mode</strong> (read the risk notice first).
                </li>
                <li>
                  2. In the chat composer's <strong>+</strong> menu, turn on{" "}
                  <strong>Developer mode</strong>.
                </li>
                <li>
                  3. Click <strong>Add sources</strong>, then <strong>Connect more</strong>.
                </li>
                <li>
                  4. Name the connector <em>MANOVIK</em> and paste the URL above.
                </li>
                <li>5. Ask ChatGPT to use MANOVIK.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Claude</CardTitle>
              <CardDescription>Add as a custom connector</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-foreground">
                <li>
                  1. Open{" "}
                  <a
                    className="text-primary underline underline-offset-2"
                    href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Claude custom connectors
                  </a>
                  .
                </li>
                <li>
                  2. Name the connector <em>MANOVIK</em> and paste the URL above.
                </li>
                <li>
                  3. Enable the connector from the chat composer, then ask Claude to use MANOVIK.
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Works with any MCP-compatible client (Cursor, Codex, and more) — paste the same URL.
        </p>
      </div>
    </div>
  );
}
