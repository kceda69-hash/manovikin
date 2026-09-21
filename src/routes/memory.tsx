import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addMemoryDoc,
  deleteMemoryDoc,
  listMemoryDocs,
  searchMemory,
} from "@/lib/memory.functions";

const TITLE = "MANOVIK Knowledge Memory";
const DESC =
  "Give MANOVIK long-term memory: store notes, docs and specs, then search them semantically across every chat.";

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
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

function MemoryPage() {
  const qc = useQueryClient();
  const fetchDocs = useServerFn(listMemoryDocs);
  const add = useServerFn(addMemoryDoc);
  const remove = useServerFn(deleteMemoryDoc);
  const search = useServerFn(searchMemory);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");

  const docs = useQuery({ queryKey: ["memory-docs"], queryFn: () => fetchDocs() });

  const addMut = useMutation({
    mutationFn: () => add({ data: { title, content, source: "paste" } }),
    onSuccess: (r) => {
      toast.success(`Indexed ${r.chunks} chunks`);
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["memory-docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const searchMut = useMutation({
    mutationFn: () => search({ data: { query, limit: 6 } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory-docs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Knowledge Memory</h1>
      <p className="text-muted-foreground mb-8">{DESC}</p>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Add to memory</h2>
        <Input
          placeholder="Title — e.g. Product spec v3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-3"
        />
        <Textarea
          placeholder="Paste notes, docs, transcripts, specs…"
          rows={7}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mb-3"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => addMut.mutate()}
            disabled={addMut.isPending || !title.trim() || !content.trim()}
          >
            {addMut.isPending ? "Indexing…" : "Store & index"}
          </Button>
          <label className="text-sm text-muted-foreground">
            <span className="cursor-pointer underline underline-offset-4">Import a file</span>
            <input
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,.log,text/*"
              className="sr-only"
              aria-label="Import a text file into memory"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 2_000_000) {
                  toast.error("File too large — keep it under 2 MB.");
                  return;
                }
                const text = await file.text();
                if (!text.trim()) {
                  toast.error("That file is empty.");
                  return;
                }
                setTitle((t) => t || file.name);
                setContent(text.slice(0, 200_000));
                toast.success(`Loaded ${file.name} — review, then store it.`);
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Semantic search</h2>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="What did we decide about pricing?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query.trim() && searchMut.mutate()}
          />
          <Button
            onClick={() => searchMut.mutate()}
            disabled={searchMut.isPending || !query.trim()}
          >
            Search
          </Button>
        </div>
        <div className="space-y-3">
          {searchMut.data?.matches.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches yet.</p>
          )}
          {searchMut.data?.matches.map((m) => (
            <div key={m.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{m.title}</span>
                <span>{Math.round(m.similarity * 100)}% match</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.content.slice(0, 600)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-4">Stored documents</h2>
        {docs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {docs.data?.docs.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing stored yet.</p>
        )}
        <ul className="divide-y">
          {docs.data?.docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d.status} · {d.chars.toLocaleString()} chars ·{" "}
                  {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${d.title}`}
                onClick={() => delMut.mutate(d.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
