import { describe, expect, it, vi } from "vitest";
import { runSentinelCheck } from "../sentinel/check.server";

// Minimal stub of the supabase query builder chain used by the sentinel.
// Each query resolves to a canned { data, count, error } triple.
function makeClient(opts: {
  devices?: Array<{ name: string }>;
  commandCount?: number;
  devicesError?: boolean;
  commandsError?: boolean;
  throwOnQuery?: boolean;
}) {
  return {
    from(table: string) {
      if (opts.throwOnQuery) throw new Error("db exploded");
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        then(resolve: any) {
          if (table === "manovik_devices") {
            return resolve({
              data: opts.devicesError ? null : (opts.devices ?? []),
              error: opts.devicesError ? { message: "boom" } : null,
            });
          }
          return resolve({
            data: [],
            count: opts.commandsError ? null : (opts.commandCount ?? 0),
            error: opts.commandsError ? { message: "boom" } : null,
          });
        },
      };
      return chain;
    },
  } as any;
}

describe("runSentinelCheck", () => {
  it("(a) alerts when a device was paired in the last 24h, naming it", async () => {
    const client = makeClient({
      devices: [{ name: "Nick's Phone" }, { name: "Laptop" }],
    });
    const { alert } = await runSentinelCheck("user-1", client);
    expect(alert).not.toBeNull();
    expect(alert!).toContain("2 new device(s) paired in the last 24h");
    expect(alert!).toContain("Nick's Phone");
    expect(alert!).toContain("/devices");
  });

  it("caps the device names shown in the alert at 5", async () => {
    const devices = Array.from({ length: 7 }, (_, i) => ({ name: `Device-${i}` }));
    const { alert } = await runSentinelCheck("user-1", makeClient({ devices }));
    expect(alert).not.toBeNull();
    expect(alert!).toContain("7 new device(s) paired in the last 24h");
    expect(alert!).toContain("Device-0");
    expect(alert!).toContain("Device-4");
    expect(alert!).not.toContain("Device-5");
    expect(alert!).not.toContain("Device-6");
  });

  it("(b) alerts on >50 commands in the last hour when no new devices", async () => {
    const client = makeClient({ devices: [], commandCount: 51 });
    const { alert } = await runSentinelCheck("user-1", client);
    expect(alert).not.toBeNull();
    expect(alert!).toContain("unusual device-command volume");
    expect(alert!).toContain("51 commands queued in the last hour");
  });

  it("stays quiet at exactly 50 commands in the last hour", async () => {
    const { alert } = await runSentinelCheck(
      "user-1",
      makeClient({ devices: [], commandCount: 50 }),
    );
    expect(alert).toBeNull();
  });

  it("(c) returns { alert: null } when everything is quiet", async () => {
    const { alert } = await runSentinelCheck(
      "user-1",
      makeClient({ devices: [], commandCount: 3 }),
    );
    expect(alert).toBeNull();
  });

  it("(d) returns a DEGRADED alert (not silent null) when the device query errors", async () => {
    const { alert } = await runSentinelCheck(
      "user-1",
      makeClient({ devicesError: true, commandCount: 100 }),
    );
    expect(alert).toContain("couldn't complete");
    expect(alert).toContain("UNVERIFIED");
  });

  it("(d) returns a DEGRADED alert (not silent null) when the command count query errors", async () => {
    const { alert } = await runSentinelCheck(
      "user-1",
      makeClient({ devices: [], commandsError: true }),
    );
    expect(alert).toContain("couldn't complete");
    expect(alert).toContain("UNVERIFIED");
  });

  it("(d) returns a DEGRADED alert (not silent null) when the client throws", async () => {
    const { alert } = await runSentinelCheck(
      "user-1",
      makeClient({ throwOnQuery: true }),
    );
    expect(alert).toContain("couldn't complete");
    expect(alert).toContain("UNVERIFIED");
  });
});
