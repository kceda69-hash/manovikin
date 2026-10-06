import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseSchedule,
  computeNextRunAt,
  isValidSchedule,
  describeSchedule,
} from "@/lib/agent-fleet/schedule";
import {
  createAgent,
  listAgents,
  getAgent,
  resolveAgent,
  setAgentStatus,
  removeAgent,
  recordAgentOutcome,
  agentRunHistory,
  fileAgentProposal,
  FleetNotSetupError,
  FLEET_TOOL_NAMES,
  MAX_AGENTS_PER_USER,
  MAX_PROPOSALS_PER_AGENT_PER_DAY,
} from "@/lib/agent-fleet/fleet.server";
import { effectiveAllowlist } from "@/lib/agent-fleet/runner.server";
import { EXECUTIVE_TEMPLATES } from "@/lib/agent-fleet/executive-templates";
import { EMPLOYEE_TEMPLATES } from "@/lib/agent-fleet/employee-templates";

// ---------------------------------------------------------------------------
// Minimal thenable Supabase-like fake. Every chained method returns the same
// thenable so `await db.from().select().eq()...` works in all positions.
// ---------------------------------------------------------------------------
function buildFake(opts: {
  rows?: Record<string, unknown[]>;
  error?: { message: string } | null;
  log?: string[];
  inserted?: unknown[];
  updated?: unknown[];
} = {}) {
  const { rows = {}, error = null, log = [], inserted = [], updated = [] } = opts;
  const resultFor = (table: string) => {
    const last = log.length > 0 ? log[log.length - 1]! : "";
    const wasSingle = last === `single:${table}`;
    const data = rows[table] ?? null;
    return {
      data: wasSingle ? (Array.isArray(data) ? (data[0] ?? null) : data) : (data ?? []),
      error,
      // Supabase returns count when requested; tests always get the row count.
      count: Array.isArray(data) ? data.length : 0,
    };
  };
  const makeChain = (table: string): unknown => {
    const chain: Record<string, unknown> = {
      select: () => (log.push(`select:${table}`), chain),
      insert: (r: unknown) => (log.push(`insert:${table}`), inserted.push(r), chain),
      update: (v: unknown) => (log.push(`update:${table}`), updated.push(v), chain),
      delete: () => (log.push(`delete:${table}`), chain),
      eq: (c: string) => (log.push(`eq:${table}.${c}`), chain),
      neq: (c: string) => (log.push(`neq:${table}.${c}`), chain),
      ilike: (c: string) => (log.push(`ilike:${table}.${c}`), chain),
      like: (c: string) => (log.push(`like:${table}.${c}`), chain),
      lte: (c: string) => (log.push(`lte:${table}.${c}`), chain),
      gte: (c: string) => (log.push(`gte:${table}.${c}`), chain),
      order: () => (log.push(`order:${table}`), chain),
      limit: (n: number) => (log.push(`limit:${table}:${n}`), chain),
      single: () => (log.push(`single:${table}`), chain),
      then: (resolve: (v: unknown) => void) => resolve(resultFor(table)),
      catch: () => Promise.resolve(resultFor(table)),
    };
    return chain;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { from: (t: string) => makeChain(t) } as any, log, inserted, updated };
}

const USER = "user-123";
const agentRow = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  user_id: USER,
  name: "Test Agent",
  role: "researcher",
  job: "Do research things thoroughly.",
  system_prompt: "",
  tools_allowlist: null,
  schedule: "daily",
  status: "active",
  last_run_at: null,
  next_run_at: new Date(Date.now() + 3600_000).toISOString(),
  last_outcome: null,
  run_count: 3,
  created_at: new Date().toISOString(),
  ...over,
});

// ---------------------------------------------------------------------------
// Schedule parsing
// ---------------------------------------------------------------------------
describe("parseSchedule", () => {
  it("parses interval presets", () => {
    expect(parseSchedule("hourly")).toMatchObject({ kind: "interval", normalized: "hourly", ms: 3_600_000 });
    expect(parseSchedule("twice daily")).toMatchObject({ kind: "interval", normalized: "12h", ms: 43_200_000 });
    expect(parseSchedule("daily")).toMatchObject({ kind: "interval", normalized: "daily", ms: 86_400_000 });
    expect(parseSchedule("weekly")).toMatchObject({ kind: "interval", normalized: "weekly", ms: 604_800_000 });
    expect(parseSchedule("  DAILY  ")).toMatchObject({ normalized: "daily" });
  });

  it("parses daily-at-time forms", () => {
    expect(parseSchedule("every morning 8am")).toMatchObject({ kind: "dailyAt", normalized: "daily@08:00", hour: 8, minute: 0 });
    expect(parseSchedule("8am")).toMatchObject({ normalized: "daily@08:00" });
    expect(parseSchedule("08:00")).toMatchObject({ normalized: "daily@08:00" });
    expect(parseSchedule("8:30pm")).toMatchObject({ normalized: "daily@20:30", hour: 20, minute: 30 });
    expect(parseSchedule("20:00")).toMatchObject({ normalized: "daily@20:00" });
    expect(parseSchedule("daily 7am")).toMatchObject({ normalized: "daily@07:00" });
  });

  it("rejects unsupported schedules with a helpful message", () => {
    expect(() => parseSchedule("fortnightly")).toThrow(/Unsupported schedule/);
    expect(() => parseSchedule("")).toThrow();
    expect(() => parseSchedule("25:00")).toThrow();
    expect(() => parseSchedule("ceo")).toThrow(/Unsupported schedule/);
    expect(isValidSchedule("hourly")).toBe(true);
    expect(isValidSchedule("nonsense")).toBe(false);
  });

  it("computes interval next-runs from a fixed clock", () => {
    const from = Date.UTC(2026, 9, 6, 0, 0, 0);
    expect(computeNextRunAt(parseSchedule("hourly"), from)).toBe(new Date(from + 3_600_000).toISOString());
  });

  it("computes the next 8am IST occurrence (before and after)", () => {
    const eight = parseSchedule("every morning 8am");
    // 2026-10-06T00:00Z = 05:30 IST → next 8am IST is 02:30Z same day
    expect(computeNextRunAt(eight, Date.UTC(2026, 9, 6, 0, 0, 0))).toBe("2026-10-06T02:30:00.000Z");
    // 2026-10-06T04:00Z = 09:30 IST (past 8am) → tomorrow 02:30Z
    expect(computeNextRunAt(eight, Date.UTC(2026, 9, 6, 4, 0, 0))).toBe("2026-10-07T02:30:00.000Z");
  });

  it("describes normalized schedules", () => {
    expect(describeSchedule("hourly")).toBe("Every hour");
    expect(describeSchedule("daily@08:00")).toBe("Daily at 8:00 AM IST");
    expect(describeSchedule("daily@20:30")).toBe("Daily at 8:30 PM IST");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe("createAgent validation", () => {
  it("rejects agent.create inside tools_allowlist", async () => {
    const { db } = buildFake();
    await expect(
      createAgent(db, USER, { name: "X", job: "Do things well.", tools_allowlist: ["reason", "agent.create"] }),
    ).rejects.toThrow(/agent\.create/);
  });

  it("rejects unknown tool names", async () => {
    const { db } = buildFake();
    await expect(
      createAgent(db, USER, { name: "X", job: "Do things well.", tools_allowlist: ["teleport"] }),
    ).rejects.toThrow(/Unknown tool name/);
  });

  it("rejects bad schedules with the parser message", async () => {
    const { db } = buildFake();
    await expect(createAgent(db, USER, { name: "X", job: "Do things well.", schedule: "fortnightly" })).rejects.toThrow(
      /Unsupported schedule/,
    );
  });

  it("fails closed when the table is missing", async () => {
    const { db } = buildFake({ error: { message: 'relation "public.manovik_agents" does not exist' } });
    await expect(createAgent(db, USER, { name: "X", job: "Do things well." })).rejects.toBeInstanceOf(
      FleetNotSetupError,
    );
  });

  it("fills defaults from a template", async () => {
    const row = agentRow({ name: "Chief Financial Officer", role: "cfo", schedule: "daily" });
    const { db, inserted } = buildFake({ rows: { manovik_agents: [row] } });
    const created = await createAgent(db, USER, { template: "cfo" });
    expect(created.name).toBe("Chief Financial Officer");
    const sent = inserted[0] as Record<string, unknown>;
    expect(sent.name).toBe("Chief Financial Officer");
    expect(sent.role).toBe("cfo");
    expect(sent.schedule).toBe("daily");
    expect(sent.next_run_at).toBeTruthy();
    expect(sent.user_id).toBe(USER);
  });

  it("rejects unknown templates", async () => {
    const { db } = buildFake();
    await expect(createAgent(db, USER, { template: "pope" })).rejects.toThrow(/Unknown agent template/);
  });

  it("requires a name/job when no template is given", async () => {
    const { db } = buildFake();
    await expect(createAgent(db, USER, {})).rejects.toThrow(/name is required/);
  });

  it("enforces the fleet cap", async () => {
    const many = Array.from({ length: MAX_AGENTS_PER_USER }, (_, i) =>
      agentRow({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    const { db } = buildFake({ rows: { manovik_agents: many } });
    await expect(createAgent(db, USER, { name: "One Too Many", job: "Do things well." })).rejects.toThrow(
      new RegExp(`${MAX_AGENTS_PER_USER} agents max`),
    );
  });

  it("stores lifecycle fields", async () => {
    const row = agentRow({ lifecycle_stage: "worker", proposed_by: null, skills: [], mentor_id: null });
    const { db, inserted } = buildFake({ rows: { manovik_agents: [row] } });
    await createAgent(db, USER, { name: "X", job: "Do things well.", skills: ["research"] });
    const sent = inserted[0] as Record<string, unknown>;
    expect(sent.lifecycle_stage).toBe("worker");
    expect(sent.skills).toEqual(["research"]);
    expect(sent.proposed_by).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ownership enforcement
// ---------------------------------------------------------------------------
describe("ownership", () => {
  it("listAgents scopes to the user", async () => {
    const { db, log } = buildFake({ rows: { manovik_agents: [agentRow()] } });
    const rows = await listAgents(db, USER);
    expect(rows).toHaveLength(1);
    expect(log).toContain("eq:manovik_agents.user_id");
  });

  it("getAgent throws when the row belongs to someone else", async () => {
    const { db } = buildFake({ rows: { manovik_agents: [] } }); // single() → null
    await expect(getAgent(db, USER, "11111111-1111-4111-8111-111111111111")).rejects.toThrow(/not found/);
  });

  it("resolveAgent finds by name via ilike", async () => {
    const { db, log } = buildFake({ rows: { manovik_agents: [agentRow()] } });
    const agent = await resolveAgent(db, USER, "Test Agent");
    expect(agent.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(log).toContain("ilike:manovik_agents.name");
    expect(log).toContain("eq:manovik_agents.user_id");
  });

  it("resolveAgent throws on ambiguous names", async () => {
    const { db } = buildFake({ rows: { manovik_agents: [agentRow(), agentRow({ id: "22222222-2222-4222-8222-222222222222" })] } });
    await expect(resolveAgent(db, USER, "Test Agent")).rejects.toThrow(/Multiple agents/);
  });

  it("removeAgent checks ownership first", async () => {
    const { db, log } = buildFake({ rows: { manovik_agents: [] } });
    await expect(removeAgent(db, USER, "11111111-1111-4111-8111-111111111111")).rejects.toThrow(/not found/);
    expect(log).not.toContain("delete:manovik_agents");
  });

  it("agentRunHistory checks ownership before reading runs", async () => {
    const { db, log } = buildFake({ rows: { manovik_agents: [] } });
    await expect(agentRunHistory(db, USER, "11111111-1111-4111-8111-111111111111")).rejects.toThrow(/not found/);
    expect(log).not.toContain("select:manovik_agi_runs");
  });
});

describe("setAgentStatus", () => {
  it("recomputes next_run_at when resuming past-due agents", async () => {
    const past = agentRow({ status: "paused", next_run_at: new Date(Date.now() - 7200_000).toISOString() });
    const { db, updated } = buildFake({ rows: { manovik_agents: [past] } });
    await setAgentStatus(db, USER, past.id, "active");
    const patch = updated[0] as Record<string, unknown>;
    expect(patch.status).toBe("active");
    expect(new Date(patch.next_run_at as string).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("recordAgentOutcome", () => {
  it("writes outcome and advances next_run_at", async () => {
    const { db, updated } = buildFake({ rows: { manovik_agents: [agentRow()] } });
    await recordAgentOutcome(db, "11111111-1111-4111-8111-111111111111", {
      status: "succeeded",
      summary: "All good",
    });
    const patch = updated[0] as Record<string, unknown>;
    expect(String(patch.last_outcome)).toContain("succeeded: All good");
    expect(patch.last_run_at).toBeTruthy();
    expect(patch.next_run_at).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// agent.propose — the safety core: proposals only, never direct creation
// ---------------------------------------------------------------------------
const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const proposalInput = {
  name: "Night Watch",
  role: "monitor",
  job: "Watch the site all night and report anomalies every morning.",
  rationale: "The CTO only runs daily; overnight gaps need coverage.",
};

describe("fileAgentProposal", () => {
  it("writes a pending proposal row, never an agent", async () => {
    const proposalRow = {
      id: "p1",
      user_id: USER,
      proposed_by_agent: AGENT_ID,
      ...proposalInput,
      status: "pending",
      created_at: new Date().toISOString(),
      decided_at: null,
    };
    const { db, inserted, log } = buildFake({
      rows: { manovik_agents: [agentRow()], manovik_agent_proposals: [proposalRow] },
    });
    const proposal = await fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, proposalInput);
    expect(proposal.status).toBe("pending");
    const sent = inserted[0] as Record<string, unknown>;
    expect(sent.status).toBe("pending");
    expect(sent.proposed_by_agent).toBe(AGENT_ID);
    expect(sent.user_id).toBe(USER);
    expect(sent.name).toBe("Night Watch");
    // It touched the proposals table, never inserted an agent.
    expect(log.some((l) => l === "insert:manovik_agent_proposals")).toBe(true);
    expect(log.some((l) => l === "insert:manovik_agents")).toBe(false);
  });

  it("accepts a JSON string input (the AGI loop passes raw text)", async () => {
    const proposalRow = { id: "p1", status: "pending" };
    const { db, inserted } = buildFake({
      rows: { manovik_agents: [agentRow()], manovik_agent_proposals: [proposalRow] },
    });
    await fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, JSON.stringify(proposalInput));
    expect((inserted[0] as Record<string, unknown>).name).toBe("Night Watch");
  });

  it("refuses without agent context", async () => {
    const { db } = buildFake();
    await expect(fileAgentProposal(db, { userId: USER }, proposalInput)).rejects.toThrow(
      /only available inside a fleet agent run/,
    );
  });

  it("rejects malformed input", async () => {
    const { db } = buildFake({ rows: { manovik_agents: [agentRow()] } });
    await expect(fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, "not json")).rejects.toThrow(
      /must be JSON/,
    );
    await expect(
      fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, { name: "X" }),
    ).rejects.toThrow();
  });

  it("refuses when the proposing agent belongs to someone else", async () => {
    const { db } = buildFake({ rows: { manovik_agents: [] } });
    await expect(
      fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, proposalInput),
    ).rejects.toThrow(/don't own/);
  });

  it("enforces the fleet cap", async () => {
    const many = Array.from({ length: MAX_AGENTS_PER_USER }, (_, i) =>
      agentRow({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    // assertOwnAgent needs the proposer present
    many[0] = agentRow({ id: AGENT_ID });
    const { db } = buildFake({ rows: { manovik_agents: many, manovik_agent_proposals: [] } });
    await expect(
      fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, proposalInput),
    ).rejects.toThrow(new RegExp(`${MAX_AGENTS_PER_USER} agents max`));
  });

  it(`enforces the ${MAX_PROPOSALS_PER_AGENT_PER_DAY}/day proposal quota`, async () => {
    const todays = Array.from({ length: MAX_PROPOSALS_PER_AGENT_PER_DAY }, (_, i) => ({ id: `p${i}` }));
    const { db, log } = buildFake({
      rows: { manovik_agents: [agentRow()], manovik_agent_proposals: todays },
    });
    await expect(
      fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, proposalInput),
    ).rejects.toThrow(/quota reached/);
    expect(log).toContain("gte:manovik_agent_proposals.created_at");
  });

  it("fails closed when the proposals table is missing", async () => {
    const { db } = buildFake({
      rows: { manovik_agents: [agentRow()], manovik_agent_proposals: [] },
      error: { message: 'relation "public.manovik_agent_proposals" does not exist' },
    });
    // Every DB read returns the canned 42P01 error; rethrowDbError converts
    // the first one (assertOwnAgent) into FleetNotSetupError.
    await expect(
      fileAgentProposal(db, { userId: USER, agentId: AGENT_ID }, proposalInput),
    ).rejects.toBeInstanceOf(FleetNotSetupError);
  });
});

// ---------------------------------------------------------------------------
// Runner allowlist
// ---------------------------------------------------------------------------
describe("effectiveAllowlist", () => {
  it("strips device, always grants finish, intersects unknown tools", () => {
    expect(effectiveAllowlist({ tools_allowlist: ["reason", "device", "fetch_url"] })).toEqual(
      expect.arrayContaining(["reason", "fetch_url", "finish"]),
    );
    const list = effectiveAllowlist({ tools_allowlist: ["reason", "device"] });
    expect(list).not.toContain("device");
    expect(list).toContain("finish");
  });

  it("defaults to all safe tools minus device when allowlist is null", () => {
    const list = effectiveAllowlist({ tools_allowlist: null });
    for (const t of FLEET_TOOL_NAMES) {
      if (t === "device") expect(list).not.toContain(t);
      else expect(list).toContain(t);
    }
  });

  it("never lets agent.create through (not an AGI tool anyway)", () => {
    const list = effectiveAllowlist({ tools_allowlist: ["reason", "agent.create"] as unknown as string[] });
    expect(list).not.toContain("agent.create");
  });
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
describe("agent templates", () => {
  it("ships 6 executives and 8 employees with correct tiers", () => {
    expect(EXECUTIVE_TEMPLATES).toHaveLength(6);
    expect(EMPLOYEE_TEMPLATES).toHaveLength(8);
    expect(EXECUTIVE_TEMPLATES.map((t) => t.key)).toEqual(["ceo", "cfo", "coo", "cto", "cmo", "hr"]);
    for (const t of EXECUTIVE_TEMPLATES) expect(t.tier).toBe("leadership");
    for (const t of EMPLOYEE_TEMPLATES) expect(t.tier).toBe("team");
  });

  it("every template has a usable job, a valid schedule, and a safe allowlist", () => {
    for (const t of [...EXECUTIVE_TEMPLATES, ...EMPLOYEE_TEMPLATES]) {
      expect(t.job.trim().length).toBeGreaterThan(60);
      expect(isValidSchedule(t.schedule)).toBe(true);
      expect(t.tools_allowlist.length).toBeGreaterThan(0);
      expect(t.tools_allowlist).not.toContain("agent.create");
      expect(t.tools_allowlist).not.toContain("device");
      for (const tool of t.tools_allowlist) {
        expect(FLEET_TOOL_NAMES as readonly string[]).toContain(tool);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tick: due-selection + failure isolation (module boundaries mocked)
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => {
  const adminLog: string[] = [];
  const dueRows: Array<{ id: string; user_id: string; name: string }> = [];
  const state: { error: { message: string } | null } = { error: null };
  const runAgentJob = vi.fn();
  const chains = (table: string): unknown => {
    const chain: Record<string, unknown> = {
      select: () => (adminLog.push(`select:${table}`), chain),
      insert: () => (adminLog.push(`insert:${table}`), chain),
      update: () => (adminLog.push(`update:${table}`), chain),
      eq: (c: string) => (adminLog.push(`eq:${table}.${c}`), chain),
      lte: (c: string) => (adminLog.push(`lte:${table}.${c}`), chain),
      order: () => (adminLog.push(`order:${table}`), chain),
      limit: (n: number) => (adminLog.push(`limit:${table}:${n}`), chain),
      single: () => (adminLog.push(`single:${table}`), chain),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: table === "manovik_agents" ? [...dueRows] : [], error: state.error }),
      catch: () => Promise.resolve({ data: [], error: state.error }),
    };
    return chain;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAdmin = { from: (t: string) => chains(t) } as any;
  return { adminLog, dueRows, runAgentJob, supabaseAdmin, state };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: hoisted.supabaseAdmin,
}));
vi.mock("@/lib/agent-fleet/runner.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent-fleet/runner.server")>();
  // Mock only the LLM-boundary run; keep the pure helpers (effectiveAllowlist).
  return { ...actual, runAgentJob: hoisted.runAgentJob };
});

describe("runDueAgents", () => {
  beforeEach(() => {
    hoisted.adminLog.length = 0;
    hoisted.dueRows.length = 0;
    hoisted.runAgentJob.mockReset();
  });

  it("only picks active agents whose next_run_at has passed", async () => {
    hoisted.dueRows.push({ id: "a1", user_id: USER, name: "Due Agent" });
    hoisted.runAgentJob.mockResolvedValue({ ok: true, agentId: "a1", status: "succeeded", summary: "done" });
    const { runDueAgents } = await import("@/lib/agent-fleet/tick.server");
    const result = await runDueAgents();
    expect(hoisted.adminLog).toContain("eq:manovik_agents.status");
    expect(hoisted.adminLog).toContain("lte:manovik_agents.next_run_at");
    expect(result).toMatchObject({ ok: true, checked: 1, ran: 1, succeeded: 1, failed: 0 });
    expect(hoisted.runAgentJob).toHaveBeenCalledTimes(1);
    expect(hoisted.runAgentJob).toHaveBeenCalledWith("a1");
  });

  it("one failing agent never stops the others", async () => {
    hoisted.dueRows.push(
      { id: "good", user_id: USER, name: "Good" },
      { id: "bad", user_id: USER, name: "Bad" },
      { id: "good2", user_id: USER, name: "Good2" },
    );
    hoisted.runAgentJob.mockImplementation(async (id: string) => {
      if (id === "bad") throw new Error("boom");
      return { ok: true, agentId: id, status: "succeeded", summary: "done" };
    });
    const { runDueAgents } = await import("@/lib/agent-fleet/tick.server");
    const result = await runDueAgents();
    expect(hoisted.runAgentJob).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ checked: 3, ran: 3, succeeded: 2, failed: 1 });
  });

  it("a runAgentJob returning ok:false counts as failed but continues", async () => {
    hoisted.dueRows.push(
      { id: "ok1", user_id: USER, name: "Ok1" },
      { id: "fail", user_id: USER, name: "Fail" },
    );
    hoisted.runAgentJob.mockImplementation(async (id: string) =>
      id === "fail"
        ? { ok: false, agentId: id, status: "failed", summary: "llm exploded" }
        : { ok: true, agentId: id, status: "succeeded", summary: "done" },
    );
    const { runDueAgents } = await import("@/lib/agent-fleet/tick.server");
    const result = await runDueAgents();
    expect(result).toMatchObject({ checked: 2, ran: 2, succeeded: 1, failed: 1 });
  });

  it("does nothing when nobody is due", async () => {
    const { runDueAgents } = await import("@/lib/agent-fleet/tick.server");
    const result = await runDueAgents();
    expect(result).toMatchObject({ ok: true, checked: 0, ran: 0 });
    expect(hoisted.runAgentJob).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runAgentJob fail-closed on missing table (real module via importActual;
// the file-level mock above is bypassed here on purpose)
// ---------------------------------------------------------------------------
describe("runAgentJob", () => {
  beforeEach(() => {
    hoisted.state.error = null;
  });

  it("fails closed with a setup message when the agents table is missing", async () => {
    hoisted.state.error = { message: 'relation "public.manovik_agents" does not exist' };
    try {
      const actual = await vi.importActual<typeof import("@/lib/agent-fleet/runner.server")>(
        "@/lib/agent-fleet/runner.server",
      );
      const result = await actual.runAgentJob("11111111-1111-4111-8111-111111111111");
      expect(result.ok).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.summary).toMatch(/not set up|migration/);
    } finally {
      hoisted.state.error = null;
    }
  });
});
