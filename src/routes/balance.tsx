import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getManovikBalance } from "@/lib/manovik-balance.functions";

export const Route = createFileRoute("/balance")({
  component: BalancePage,
  head: () => ({
    meta: [{ title: "Manovik AI Balance" }],
  }),
});

function BalancePage() {
  const fetchBalance = useServerFn(getManovikBalance);
  const { data, isLoading, error } = useQuery({
    queryKey: ["manovik-balance"],
    queryFn: () => fetchBalance(),
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Manovik AI Balance</h1>
      <p className="text-muted-foreground mb-8">
        Native Manovik credits — independent of any external provider. 1 credit per chat message.
      </p>

      {isLoading && <p>Loading…</p>}
      {error && <p className="text-destructive">Failed to load balance.</p>}

      {data && (
        <>
          <div className="rounded-2xl border bg-card p-8 mb-8">
            <div className="text-sm text-muted-foreground">Current balance</div>
            <div className="text-5xl font-bold mt-1">{data.credits}</div>
            <div className="text-xs text-muted-foreground mt-2">
              {data.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleString()}` : ""}
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-3">Recent activity</h2>
          <ul className="divide-y rounded-xl border">
            {data.ledger.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">No activity yet.</li>
            )}
            {data.ledger.map((row: any, i: number) => (
              <li key={i} className="flex justify-between p-4 text-sm">
                <span>
                  <span className={row.delta < 0 ? "text-destructive" : "text-emerald-500"}>
                    {row.delta > 0 ? `+${row.delta}` : row.delta}
                  </span>{" "}
                  · {row.reason}
                </span>
                <span className="text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
