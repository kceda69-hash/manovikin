import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys.functions";

const TITLE = "MANOVIK API Keys";
const DESC =
  "Issue API keys and call MANOVIK AI from your own apps, scripts and back ends over a simple HTTP endpoint.";

export const Route = createFileRoute("/keys")({
  component: KeysPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
  }),
});

function KeysPage() {
  const qc = useQueryClient();
  const fetchKeys = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);

  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["api-keys"], queryFn: () => fetchKeys() });

  const createMut = useMutation({
    mutationFn: () => create({ data: { label, scopes: ["ask"] } }),
    onSuccess: (r) => {
      setIssued(r.key);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">API Keys</h1>
      <p className="text-muted-foreground mb-8">{DESC}</p>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Issue a key</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Label — e.g. Production backend"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !label.trim()}>
            Create
          </Button>
        </div>
        {issued && (
          <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-medium mb-2">
              Copy this key now — it is shown only once.
            </p>
            <code className="block break-all rounded bg-muted p-3 text-sm">{issued}</code>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(issued);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Your keys</h2>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data?.keys.length === 0 && <p className="text-sm text-muted-foreground">No keys yet.</p>}
        <ul className="divide-y">
          {q.data?.keys.map((k: any) => (
            <li key={k.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">
                  {k.label}{" "}
                  {k.revoked_at && <span className="text-xs text-destructive">(revoked)</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {k.key_prefix}… · {k.use_count} calls ·{" "}
                  {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : "never used"}
                </div>
              </div>
              {!k.revoked_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Revoke ${k.label}`}
                  onClick={async () => {
                    await revoke({ data: { id: k.id } });
                    qc.invalidateQueries({ queryKey: ["api-keys"] });
                  }}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-3">Usage</h2>
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
{`curl https://manovik.in/api/public/v1/ask \\
  -H "Authorization: Bearer mnvk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Explain CRDTs in 5 bullets"}'`}
        </pre>
      </section>
    </main>
  );
}
