import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptMyInvites,
  createWorkspace,
  inviteToWorkspace,
  listWorkspaceDetail,
  listWorkspaces,
} from "@/lib/workspaces.functions";

const TITLE = "MANOVIK Team Workspaces";
const DESC =
  "Create shared MANOVIK workspaces, invite teammates by email and control who can view or edit your projects.";

export const Route = createFileRoute("/team")({
  component: TeamPage,
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

function TeamPage() {
  const qc = useQueryClient();
  const fetchWorkspaces = useServerFn(listWorkspaces);
  const fetchDetail = useServerFn(listWorkspaceDetail);
  const create = useServerFn(createWorkspace);
  const invite = useServerFn(inviteToWorkspace);
  const accept = useServerFn(acceptMyInvites);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [selected, setSelected] = useState<string | null>(null);

  const ws = useQuery({ queryKey: ["workspaces"], queryFn: () => fetchWorkspaces() });

  useEffect(() => {
    accept()
      .then((r) => {
        if (r.joined > 0) {
          toast.success(`Joined ${r.joined} workspace(s)`);
          qc.invalidateQueries({ queryKey: ["workspaces"] });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detail = useQuery({
    queryKey: ["workspace-detail", selected],
    queryFn: () => fetchDetail({ data: { workspaceId: selected! } }),
    enabled: !!selected,
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: { name } }),
    onSuccess: () => {
      setName("");
      toast.success("Workspace created");
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { workspaceId: selected!, email, role: role as any } }),
    onSuccess: () => {
      setEmail("");
      toast.success("Invite created");
      qc.invalidateQueries({ queryKey: ["workspace-detail", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Team Workspaces</h1>
      <p className="text-muted-foreground mb-8">{DESC}</p>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Create a workspace</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || name.trim().length < 2}>
            Create
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6 mb-8">
        <h2 className="font-semibold mb-4">Your workspaces</h2>
        {ws.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {ws.data?.workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground">No workspaces yet.</p>
        )}
        <ul className="divide-y">
          {ws.data?.workspaces.map((w: any) => (
            <li key={w.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-muted-foreground">
                  {w.slug} · your role: {w.role}
                </div>
              </div>
              <Button
                size="sm"
                variant={selected === w.id ? "default" : "secondary"}
                onClick={() => setSelected(w.id)}
              >
                Manage
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold mb-4">Members & invites</h2>
          <div className="flex flex-wrap gap-2 mb-5">
            <Input
              className="flex-1 min-w-[220px]"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              aria-label="Invite role"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {["admin", "editor", "viewer"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending || !email.includes("@")}>
              Invite
            </Button>
          </div>

          <h3 className="text-sm font-medium mb-2">Members</h3>
          <ul className="mb-5 text-sm">
            {detail.data?.members.map((m: any) => (
              <li key={m.id} className="py-1 text-muted-foreground">
                {m.user_id.slice(0, 8)}… — {m.role}
              </li>
            ))}
          </ul>

          <h3 className="text-sm font-medium mb-2">Pending invites</h3>
          <ul className="text-sm">
            {detail.data?.invites.filter((i: any) => !i.accepted_at).length === 0 && (
              <li className="text-muted-foreground">None.</li>
            )}
            {detail.data?.invites
              .filter((i: any) => !i.accepted_at)
              .map((i: any) => (
                <li key={i.id} className="py-1 text-muted-foreground">
                  {i.email} — {i.role}
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
