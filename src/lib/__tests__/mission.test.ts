// Tests for Track D — autonomous missions: fetch_url SSRF guard, tool whitelist,
// response truncation, the device queue helper, and a 2-step AGI loop.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mano/engine.server", () => ({
  manoComplete: vi.fn(),
  runMano: vi.fn(),
}));

vi.mock("@/lib/mano/training.server", () => ({
  loadDoctrine: vi.fn(async () => ""),
}));

vi.mock("@/lib/memory/store.server", () => ({
  storeMemoryFacts: vi.fn(async () => 1),
}));

import {
  fetchUrlTool,
  isFetchUrlAllowed,
  parseAction,
  runAgiMission,
  runMissionDeviceTool,
  type SupabaseLike,
} from "@/lib/mano/agi.server";
import { manoComplete, runMano } from "@/lib/mano/engine.server";

const mockComplete = vi.mocked(manoComplete);
const mockRunMano = vi.mocked(runMano);

afterEach(() => {
  vi.unstubAllGlobals();
  mockComplete.mockReset();
  mockRunMano.mockReset();
});

/** Minimal chainable supabase stub matching the SupabaseLike shape. */
function supabaseMock(tables: Record<string, unknown[]> = {}) {
  const calls: Array<{ table: string; op: string; row?: Record<string, unknown> }> = [];
  const makeChain = (table: string): unknown => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      update: () => chain,
      insert: async (row: Record<string, unknown>) => {
        calls.push({ table, op: "insert", row });
        return { error: null };
      },
      limit: async () => ({ data: (tables[table] ?? []) as unknown[] }),
    };
    return chain;
  };
  return { supabase: { from: (table: string) => makeChain(table) } as unknown as SupabaseLike, calls };
}

describe("isFetchUrlAllowed (SSRF guard)", () => {
  it("blocks localhost, loopback, private and link-local IPs", () => {
    for (const url of [
      "http://localhost/x",
      "http://localhost:8080/x",
      "http://LOCALHOST/x",
      "http://127.0.0.1/x",
      "https://127.4.5.6/x",
      "http://10.0.0.5/x",
      "https://10.255.255.1/x",
      "http://192.168.1.1/",
      "https://172.16.0.1/x",
      "https://172.31.255.254/x",
      "http://169.254.169.254/latest/meta-data",
    ]) {
      expect(isFetchUrlAllowed(url), url).toBe(false);
    }
  });

  it("blocks metadata hosts and non-http(s) schemes", () => {
    expect(isFetchUrlAllowed("http://metadata.google.internal/")).toBe(false);
    expect(isFetchUrlAllowed("ftp://example.com/x")).toBe(false);
    expect(isFetchUrlAllowed("file:///etc/passwd")).toBe(false);
    expect(isFetchUrlAllowed("javascript:alert(1)")).toBe(false);
    expect(isFetchUrlAllowed("not a url")).toBe(false);
  });

  it("allows ordinary public hosts", () => {
    expect(isFetchUrlAllowed("https://example.com/page?q=1")).toBe(true);
    expect(isFetchUrlAllowed("http://en.wikipedia.org/wiki/Mumbai")).toBe(true);
    expect(isFetchUrlAllowed("https://172.32.0.1/x")).toBe(true); // 172.32.x is public
    expect(isFetchUrlAllowed("https://11.0.0.1/x")).toBe(true); // 11.x is public
  });
});

describe("fetchUrlTool", () => {
  it("returns inert visible text truncated to 8000 chars", async () => {
    const longHtml = `<html><head><script>var x=1;</script><style>p{color:red}</style></head><body>${"<p>word </p>".repeat(2000)}</body></html>`;
    expect(longHtml.length).toBeGreaterThan(8000);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: "https://example.com/page",
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => longHtml,
      })),
    );
    const out = await fetchUrlTool("https://example.com/page");
    expect(out.length).toBeLessThanOrEqual(8000);
    expect(out).not.toContain("var x=1;");
    expect(out).not.toContain("color:red");
    expect(out).toContain("word");
  });

  it("refuses blocked URLs without fetching", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const out = await fetchUrlTool("http://127.0.0.1:8080/secret");
    expect(spy).not.toHaveBeenCalled();
    expect(out).toMatch(/blocked/);
  });

  it("reports HTTP errors as inert strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        url: "https://example.com/missing",
        headers: new Headers(),
        text: async () => "not found",
      })),
    );
    const out = await fetchUrlTool("https://example.com/missing");
    expect(out).toMatch(/HTTP 404/);
  });
});

describe("parseAction whitelist", () => {
  it("falls back to reason for unknown tools", () => {
    const action = parseAction('{"thought":"do evil","tool":"exec_shell","input":"rm -rf /"}');
    expect(action.tool).toBe("reason");
    expect(action.thought).toBe("recovered from unstructured control output");
  });

  it("accepts the new tools", () => {
    for (const tool of ["fetch_url", "device", "remember", "memory_search", "note", "finish"]) {
      const action = parseAction(`{"thought":"t","tool":"${tool}","input":"x"}`);
      expect(action.tool).toBe(tool);
    }
  });
});

describe("runMissionDeviceTool", () => {
  it("queues a command for an explicitly chosen paired device", async () => {
    const { supabase, calls } = supabaseMock({
      manovik_devices: [{ id: "d1", name: "Pixel", paired_at: "2026-01-01" }],
    });
    const out = await runMissionDeviceTool(
      supabase,
      "user-1",
      JSON.stringify({ kind: "notify", payload: "hello", deviceId: "d1" }),
    );
    expect(out).toMatch(/queued/i);
    const insert = calls.find((c) => c.table === "manovik_device_commands");
    expect(insert?.row).toMatchObject({
      device_id: "d1",
      user_id: "user-1",
      kind: "notify",
      command: "hello",
    });
  });

  it("rejects shell/script kinds and malformed input", async () => {
    const { supabase } = supabaseMock();
    const badKind = await runMissionDeviceTool(
      supabase,
      "user-1",
      JSON.stringify({ kind: "shell", payload: "ls" }),
    );
    expect(badKind).toMatch(/kind must be one of/);
    const badJson = await runMissionDeviceTool(supabase, "user-1", "not json");
    expect(badJson).toMatch(/must be JSON/);
  });
});

describe("runAgiMission 2-step loop", () => {
  it("records steps with idx/thought/tool/input/observation and finishes", async () => {
    const { supabase } = supabaseMock({ manovik_agi_lessons: [] });
    const html = `<html><body><h1>Headphones</h1><p>${"great ".repeat(500)}</p></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: "https://example.com/hp",
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => html,
      })),
    );

    mockComplete
      .mockImplementationOnce(async () =>
        JSON.stringify({
          thought: "Research the top headphone picks.",
          tool: "fetch_url",
          input: "https://example.com/hp",
        }),
      )
      .mockImplementationOnce(async () =>
        JSON.stringify({
          thought: "I have the research; done.",
          tool: "finish",
          input: "Top picks gathered from example.com.",
        }),
      )
      .mockImplementationOnce(async () =>
        JSON.stringify({ score: 90, topic: "headphones", lesson: "Compare before buying." }),
      );
    mockRunMano.mockResolvedValue({ text: "FINAL ANSWER" } as never);

    const result = await runAgiMission({
      goal: "research the best noise-cancelling headphones",
      supabase,
      userId: "user-1",
      maxSteps: 5,
    });

    expect(result.status).toBe("done");
    expect(result.steps).toHaveLength(2);
    const [s1, s2] = result.steps;
    expect(s1).toMatchObject({ idx: 1, tool: "fetch_url" });
    expect(s1!.thought).toContain("Research the top headphone picks");
    expect(s1!.input).toBe("https://example.com/hp");
    expect(s1!.observation).toContain("Headphones");
    expect(typeof s1!.ms).toBe("number");
    expect(s2).toMatchObject({ idx: 2, tool: "finish" });
    expect(s2!.observation).toBe("Mission criteria met.");
    expect(result.answer).toBe("FINAL ANSWER");
  });
});
