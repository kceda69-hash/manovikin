import { describe, expect, it } from "vitest";
import { sandbox } from "@/lib/agent-tools";
import { buildBriefingText } from "@/lib/schedules/briefing.server";

const user = "test-user";

describe("routine tools are registered", () => {
  it("exposes routine.create/list/pause/resume/cancel", () => {
    const names = sandbox.list().map((t) => t.name);
    for (const n of [
      "routine.create",
      "routine.list",
      "routine.pause",
      "routine.resume",
      "routine.cancel",
    ]) {
      expect(names).toContain(n);
    }
  });

  it("rejects routine.create with a bad cadence before touching the DB", async () => {
    const r = await sandbox.run(
      "routine.create",
      { name: "x", objective: "do the thing daily", cadence: "minutely" },
      user,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects routine.pause with a non-uuid id", async () => {
    const r = await sandbox.run("routine.pause", { routineId: "not-a-uuid" }, user);
    expect(r.ok).toBe(false);
  });
});

describe("buildBriefingText", () => {
  const base = {
    name: "Morning briefing",
    objective: "Summarize overnight news",
    status: "success" as const,
    answer: "Markets up. Nothing urgent.",
    actions: [],
    durationMs: 42000,
  };

  it("renders a success briefing with the routine name and answer", () => {
    const text = buildBriefingText(base);
    expect(text).toContain("Morning briefing");
    expect(text).toContain("Summarize overnight news");
    expect(text).toContain("Markets up. Nothing urgent.");
    expect(text).toContain("completed");
  });

  it("renders proposed actions as a numbered approval list", () => {
    const text = buildBriefingText({
      ...base,
      actions: [
        { label: "Notify phone", kind: "notify", command: "Briefing ready", risk: "low", why: "So you see it" },
        { label: "Open dashboard", kind: "open", command: "https://x.test", risk: "low", why: "Review numbers" },
      ],
    });
    expect(text).toContain("Proposed actions");
    expect(text).toContain("1. **Notify phone**");
    expect(text).toContain("2. **Open dashboard**");
  });

  it("renders the actual command payload in each approval item (audit fix)", () => {
    const text = buildBriefingText({
      ...base,
      actions: [
        { label: "Wipe cache", kind: "shell", command: "rm -rf /tmp/cache", risk: "high", why: "Free space" },
      ],
    });
    // The approver must see what "do 1" actually runs.
    expect(text).toContain("`rm -rf /tmp/cache`");
  });

  it("truncates long commands in the approval list", () => {
    const long = "x".repeat(500);
    const text = buildBriefingText({
      ...base,
      actions: [{ label: "Big", kind: "shell", command: long, risk: "high", why: "y" }],
    });
    expect(text).toContain("…");
    expect(text).not.toContain(long);
  });

  it("renders a failure briefing with the error", () => {
    const text = buildBriefingText({
      ...base,
      status: "failed",
      answer: "",
      error: "upstream timeout",
    });
    expect(text).toContain("failed");
    expect(text).toContain("upstream timeout");
  });
});
