import { describe, expect, it } from "vitest";
import { sandbox } from "@/lib/agent-tools";

const user = "test-user";

describe("datetime.calc", () => {
  it("adds days", async () => {
    const r = await sandbox.run("datetime.calc", { op: "add", date: "2026-09-21", days: 10 }, user);
    expect(r.ok).toBe(true);
    const o = r.output as { result: string; weekday: string };
    expect(o.result).toBe("2026-10-01");
    expect(o.weekday).toBe("Thursday");
  });
  it("subtracts days", async () => {
    const r = await sandbox.run("datetime.calc", { op: "add", date: "2026-09-21", days: -21 }, user);
    expect(r.ok).toBe(true);
    expect((r.output as { result: string }).result).toBe("2026-08-31");
  });
  it("diffs two dates", async () => {
    const r = await sandbox.run(
      "datetime.calc",
      { op: "diff", date: "2026-09-21", other: "2026-09-28" },
      user,
    );
    expect(r.ok).toBe(true);
    expect((r.output as { days: number }).days).toBe(7);
  });
  it("reports weekday info", async () => {
    const r = await sandbox.run("datetime.calc", { op: "info", date: "2026-09-21" }, user);
    expect(r.ok).toBe(true);
    const o = r.output as { weekday: string; isWeekend: boolean; isoWeek: number };
    expect(o.weekday).toBe("Monday");
    expect(o.isWeekend).toBe(false);
    expect(o.isoWeek).toBe(39);
  });
  it("rejects invalid dates", async () => {
    const r = await sandbox.run("datetime.calc", { op: "info", date: "not-a-date" }, user);
    expect(r.ok).toBe(false);
  });
});

describe("text.stats", () => {
  it("counts words, sentences and reading time", async () => {
    const r = await sandbox.run("text.stats", { input: "Hello world. This is a test." }, user);
    expect(r.ok).toBe(true);
    const o = r.output as { words: number; sentences: number; characters: number; topKeywords: unknown[] };
    expect(o.words).toBe(6);
    expect(o.sentences).toBe(2);
    expect(o.characters).toBe(28);
    expect(o.topKeywords.length).toBeGreaterThan(0);
  });
});

describe("data.convert", () => {
  it("pretty-prints JSON", async () => {
    const r = await sandbox.run("data.convert", { op: "json_pretty", input: '{"a":1}' }, user);
    expect(r.ok).toBe(true);
    expect((r.output as { result: string }).result).toBe('{\n  "a": 1\n}');
  });
  it("validates JSON", async () => {
    const ok = await sandbox.run("data.convert", { op: "json_validate", input: "[1,2]" }, user);
    expect((ok.output as { valid: boolean }).valid).toBe(true);
    const bad = await sandbox.run("data.convert", { op: "json_validate", input: "{oops" }, user);
    expect(bad.ok).toBe(true);
    expect((bad.output as { valid: boolean }).valid).toBe(false);
  });
  it("converts JSON array to CSV", async () => {
    const r = await sandbox.run(
      "data.convert",
      { op: "json_to_csv", input: '[{"name":"a","v":1},{"name":"b","v":2}]' },
      user,
    );
    expect(r.ok).toBe(true);
    const o = r.output as { result: string; rows: number };
    expect(o.result).toBe("name,v\na,1\nb,2");
    expect(o.rows).toBe(2);
  });
  it("converts CSV to JSON", async () => {
    const r = await sandbox.run(
      "data.convert",
      { op: "csv_to_json", input: "name,v\na,1\nb,2" },
      user,
    );
    expect(r.ok).toBe(true);
    const o = r.output as { result: Array<Record<string, string>>; rows: number };
    expect(o.rows).toBe(2);
    expect(o.result[0]).toEqual({ name: "a", v: "1" });
  });
  it("handles quoted CSV fields", async () => {
    const r = await sandbox.run(
      "data.convert",
      { op: "csv_to_json", input: 'name,note\n"a","says ""hi"", ok"' },
      user,
    );
    expect(r.ok).toBe(true);
    expect((r.output as { result: Array<Record<string, string>> }).result[0]?.note).toBe('says "hi", ok');
  });
});

describe("crypto.utils", () => {
  it("hashes sha256 to the known vector", async () => {
    const r = await sandbox.run("crypto.utils", { op: "sha256", input: "hello" }, user);
    expect(r.ok).toBe(true);
    expect((r.output as { hex: string }).hex).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
  it("generates a valid uuid v4", async () => {
    const r = await sandbox.run("crypto.utils", { op: "uuid" }, user);
    expect(r.ok).toBe(true);
    expect((r.output as { uuid: string }).uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
  it("generates random hex of the right length", async () => {
    const r = await sandbox.run("crypto.utils", { op: "random_hex", bytes: 8 }, user);
    expect(r.ok).toBe(true);
    expect((r.output as { hex: string }).hex).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("color.convert", () => {
  it("converts hex to rgb and hsl", async () => {
    const r = await sandbox.run("color.convert", { op: "convert", color: "#ff0000" }, user);
    expect(r.ok).toBe(true);
    const o = r.output as { hex: string; rgb: string; hsl: string };
    expect(o.rgb).toBe("rgb(255, 0, 0)");
    expect(o.hsl).toBe("hsl(0, 100%, 50%)");
  });
  it("parses shorthand hex", async () => {
    const r = await sandbox.run("color.convert", { op: "convert", color: "#fff" }, user);
    expect(r.ok).toBe(true);
    expect((r.output as { hex: string }).hex).toBe("#ffffff");
  });
  it("computes black-on-white contrast as 21", async () => {
    const r = await sandbox.run(
      "color.convert",
      { op: "contrast", color: "#000000", other: "#ffffff" },
      user,
    );
    expect(r.ok).toBe(true);
    const o = r.output as { ratio: number; aaNormal: boolean; aaaNormal: boolean };
    expect(o.ratio).toBe(21);
    expect(o.aaNormal).toBe(true);
    expect(o.aaaNormal).toBe(true);
  });
  it("rejects bad colors", async () => {
    const r = await sandbox.run("color.convert", { op: "convert", color: "blurple" }, user);
    expect(r.ok).toBe(false);
  });
});

describe("web.search", () => {
  it("rejects too-short queries without hitting the network", async () => {
    const r = await sandbox.run("web.search", { query: "a" }, user);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Invalid input/);
  });
});

describe("tool registry integrity", () => {
  it("exposes all ten tools with descriptions", () => {
    const names = sandbox.list().map((t) => t.name);
    for (const expected of [
      "math.eval",
      "text.transform",
      "time.now",
      "http.get",
      "datetime.calc",
      "text.stats",
      "data.convert",
      "crypto.utils",
      "web.search",
      "color.convert",
    ]) {
      expect(names).toContain(expected);
    }
    for (const t of sandbox.list()) {
      expect(t.description.length).toBeGreaterThan(10);
    }
  });
  it("rejects unregistered tools", async () => {
    const r = await sandbox.run("shell.exec", { cmd: "rm -rf /" }, user);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not whitelisted/);
  });
});
