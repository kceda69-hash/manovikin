/**
 * Focused tests for the server-enforced confirmation queue
 * (src/lib/pending-actions.server.ts) — the structural fix for the audit
 * finding that gmail.send / guest-visible calendar writes were gated only
 * by prompt prose.
 */
import { describe, expect, it } from "vitest";
import {
  PendingActionsUnavailableError,
  consumePendingAction,
  stagePendingAction,
  type PendingActionsDb,
} from "@/lib/pending-actions.server";

interface Row {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  token: string;
  status: string;
  expires_at: string;
}

/** In-memory fake of the manovik_pending_actions table. */
function makeFakeDb(opts: { missingTable?: boolean } = {}): { db: PendingActionsDb; rows: Row[] } {
  const rows: Row[] = [];
  let seq = 0;
  const missing = () =>
    Promise.resolve({ data: null, error: { code: "42P01", message: 'relation "manovik_pending_actions" does not exist' } });

  const chainFor = (table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let insertRow: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> | null = null;
    const chain: Record<string, (...a: never[]) => unknown> = {
      insert: (row: Record<string, unknown>) => {
        insertRow = row;
        return chain;
      },
      update: (p: Record<string, unknown>) => {
        patch = p;
        return chain;
      },
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters.push((r) => (r as unknown as Record<string, unknown>)[col] === val);
        return chain;
      },
      gt: (col: string, val: unknown) => {
        filters.push(
          (r) => (r as unknown as Record<string, unknown>)[col] as string > (val as string),
        );
        return chain;
      },
      lt: (col: string, val: string) => {
        filters.push((r) => ((r as unknown as Record<string, unknown>)[col] as string) < val);
        return chain;
      },
      delete: () => chain,
      single: () => {
        if (opts.missingTable || table !== "manovik_pending_actions") return missing();
        if (insertRow) {
          const row = { ...insertRow, id: `id-${++seq}` } as Row;
          rows.push(row);
          insertRow = null;
          return Promise.resolve({ data: { id: row.id, token: row.token }, error: null });
        }
        return Promise.resolve({ data: null, error: { message: "nope" } });
      },
      maybeSingle: () => {
        if (opts.missingTable || table !== "manovik_pending_actions") return missing();
        if (patch) {
          const match = rows.find((r) => filters.every((f) => f(r)));
          if (match) {
            Object.assign(match, patch);
            patch = null;
            return Promise.resolve({ data: { payload: match.payload }, error: null });
          }
          patch = null;
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (onF: () => void) => {
        // delete().lt() cleanup path — drop expired rows.
        if (table === "manovik_pending_actions") {
          const cutoff = new Date().toISOString();
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].expires_at < cutoff) rows.splice(i, 1);
          }
        }
        onF();
        return Promise.resolve();
      },
    };
    return chain;
  };
  return { db: { from: (t: string) => chainFor(t) }, rows };
}

describe("stagePendingAction", () => {
  it("freezes the payload and mints a single-use token", async () => {
    const { db, rows } = makeFakeDb();
    const staged = await stagePendingAction("u1", "gmail.send", { to: "a@b.c", subject: "s", body: "b" }, db);
    expect(staged.token).toMatch(/^[0-9a-f]{64}$/);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "u1",
      kind: "gmail.send",
      status: "pending",
      payload: { to: "a@b.c", subject: "s", body: "b" },
    });
    expect(new Date(staged.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("throws PendingActionsUnavailableError when the migration is not applied", async () => {
    const { db } = makeFakeDb({ missingTable: true });
    await expect(stagePendingAction("u1", "gmail.send", {}, db)).rejects.toBeInstanceOf(
      PendingActionsUnavailableError,
    );
  });
});

describe("consumePendingAction", () => {
  it("returns the frozen payload on first valid consume", async () => {
    const { db } = makeFakeDb();
    const staged = await stagePendingAction("u1", "calendar.cancel", { eventId: "ev1" }, db);
    const payload = await consumePendingAction("u1", "calendar.cancel", staged.token, db);
    expect(payload).toEqual({ eventId: "ev1" });
  });

  it("is single-use: second consume returns null", async () => {
    const { db } = makeFakeDb();
    const staged = await stagePendingAction("u1", "gmail.send", { to: "a@b.c" }, db);
    expect(await consumePendingAction("u1", "gmail.send", staged.token, db)).not.toBeNull();
    expect(await consumePendingAction("u1", "gmail.send", staged.token, db)).toBeNull();
  });

  it("rejects wrong token, wrong user, wrong kind", async () => {
    const { db } = makeFakeDb();
    const staged = await stagePendingAction("u1", "gmail.send", { to: "a@b.c" }, db);
    expect(await consumePendingAction("u1", "gmail.send", "nope", db)).toBeNull();
    expect(await consumePendingAction("u2", "gmail.send", staged.token, db)).toBeNull();
    expect(await consumePendingAction("u1", "calendar.cancel", staged.token, db)).toBeNull();
    // The valid consume still works afterwards.
    expect(await consumePendingAction("u1", "gmail.send", staged.token, db)).not.toBeNull();
  });

  it("rejects expired tokens", async () => {
    const { db, rows } = makeFakeDb();
    const staged = await stagePendingAction("u1", "gmail.send", { to: "a@b.c" }, db);
    rows[0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await consumePendingAction("u1", "gmail.send", staged.token, db)).toBeNull();
  });
});
