import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the side-effectful dynamic imports used by school/lifecycle modules.
vi.mock("@/lib/agent-audit.server", () => ({ logAgentAction: vi.fn() }));
vi.mock("@/lib/mano/training.server", () => ({
  loadDoctrine: vi.fn().mockResolvedValue("HOUSE DOCTRINE: be helpful."),
}));
vi.mock("@/lib/agent-fleet/runner.server", () => ({
  runAgentJob: vi.fn(),
}));

import { runAgentJob } from "@/lib/agent-fleet/runner.server";
import {
  enrollStudent,
  teachStudent,
  graduateStudent,
  listProposals,
  approveProposal,
  rejectProposal,
  extractSkillsFromReport,
  dedupeSkills,
  studyRunMarker,
  hasCompletedStudySession,
  compileStudyPack,
} from "@/lib/agent-fleet/school.server";
import {
  promoteToMentor,
  retireAgent,
  canPromoteToMentor,
  isTickableStage,
} from "@/lib/agent-fleet/lifecycle.server";

// ---------------------------------------------------------------------------
// Smarter in-memory Supabase-like fake: interprets eq/in/like/gte/lte,
// applies insert/update/delete to the store, honors single()/limit().
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/%/g, ".*").replace(/_/g, ".") + "$");
}

function buildStore(seed: Record<string, Row[]> = {}) {
  const store = new Map<string, Row[]>(
    Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]),
  );
  const calls: Array<{ op: string; table: string; payload?: unknown }> = [];

  const match = (row: Row, filters: Array<{ col: string; op: string; val: unknown }>) =>
    filters.every(({ col, op, val }) => {
      const v = row[col];
      if (op === "eq") return v === val || (v == null && val == null);
      if (op === "in") return Array.isArray(val) && (val as unknown[]).includes(v);
      if (op === "like") return typeof v === "string" && likeToRegExp(String(val)).test(v);
      if (op === "gte") return String(v ?? "") >= String(val);
      if (op === "lte") return String(v ?? "") <= String(val);
      return true;
    });

  const makeChain = (table: string) => {
    const filters: Array<{ col: string; op: string; val: unknown }> = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: unknown = null;
    let wantSingle = false;
    let limitN: number | null = null;

    const resolve = () => {
      const rows = store.get(table) ?? [];
      if (op === "insert") {
        const row = { ...(payload as Row) };
        if (!row.id) row.id = `gen-${Math.random().toString(36).slice(2, 10)}`;
        (store.get(table) ?? store.set(table, []).get(table)!).push(row);
        calls.push({ op: "insert", table, payload: row });
        return { data: wantSingle ? row : [row], error: null };
      }
      if (op === "update") {
        const matched = rows.filter((r) => match(r, filters));
        for (const r of matched) Object.assign(r, payload as Row);
        calls.push({ op: "update", table, payload });
        return { data: wantSingle ? (matched[0] ?? null) : matched, error: null };
      }
      if (op === "delete") {
        const kept = rows.filter((r) => !match(r, filters));
        store.set(table, kept);
        calls.push({ op: "delete", table });
        return { data: [], error: null };
      }
      let out = rows.filter((r) => match(r, filters));
      if (limitN != null) out = out.slice(0, limitN);
      calls.push({ op: "select", table });
      return { data: wantSingle ? (out[0] ?? null) : out, error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (r: unknown) => ((op = "insert"), (payload = r), chain),
      update: (v: unknown) => ((op = "update"), (payload = v), chain),
      delete: () => ((op = "delete"), chain),
      eq: (c: string, v: unknown) => (filters.push({ col: c, op: "eq", val: v }), chain),
      neq: (c: string, v: unknown) => (filters.push({ col: c, op: "neq", val: v }), chain),
      in: (c: string, v: unknown) => (filters.push({ col: c, op: "in", val: v }), chain),
      ilike: (c: string, v: string) => (filters.push({ col: c, op: "like", val: v }), chain),
      like: (c: string, v: string) => (filters.push({ col: c, op: "like", val: v }), chain),
      lte: (c: string, v: unknown) => (filters.push({ col: c, op: "lte", val: v }), chain),
      gte: (c: string, v: unknown) => (filters.push({ col: c, op: "gte", val: v }), chain),
      order: () => chain,
      limit: (n: number) => ((limitN = n), chain),
      single: () => ((wantSingle = true), chain),
      then: (resolve_: (v: unknown) => void) => resolve_(resolve()),
      catch: () => Promise.resolve(resolve()),
    };
    return chain;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { from: (t: string) => makeChain(t) } as any, calls, store };
}

const USER = "user-123";
const agentRow = (over: Row = {}): Row => ({
  id: "11111111-1111-4111-8111-111111111111",
  user_id: USER,
  name: "New Hire",
  role: "researcher",
  job: "Research things thoroughly.",
  system_prompt: "",
  tools_allowlist: null,
  schedule: "daily",
  status: "active",
  last_run_at: null,
  next_run_at: null,
  last_outcome: null,
  run_count: 0,
  created_at: new Date().toISOString(),
  lifecycle_stage: "applicant",
  proposed_by: null,
  skills: [],
  mentor_id: null,
  ...over,
});

const proposalRow = (over: Row = {}): Row => ({
  id: "22222222-2222-4222-8222-222222222222",
  user_id: USER,
  proposed_by_agent: "33333333-3333-4333-8333-333333333333",
  name: "Dream Hire",
  role: "analyst",
  job: "Analyze things deeply every day.",
  rationale: "We need deeper analysis.",
  status: "pending",
  created_at: new Date().toISOString(),
  decided_at: null,
  decision_note: null,
  ...over,
});

beforeEach(() => {
  vi.mocked(runAgentJob).mockReset();
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
describe("extractSkillsFromReport", () => {
  it("parses a semicolon SKILLS section", () => {
    const out = extractSkillsFromReport(
      "Report body here.\nSKILLS: summarize security headers; draft retailer posts; triage inbox",
    );
    expect(out).toEqual([
      "summarize security headers",
      "draft retailer posts",
      "triage inbox",
    ]);
  });

  it("handles newline/bullet lists and strips bullets", () => {
    const out = extractSkillsFromReport("Done.\nskills:\n- write sql\n* review copy\n2. check links");
    expect(out).toEqual(["write sql", "review copy", "check links"]);
  });

  it("returns [] when no SKILLS section", () => {
    expect(extractSkillsFromReport("Just a plain report.")).toEqual([]);
  });

  it("drops too-short and too-long items", () => {
    const out = extractSkillsFromReport("SKILLS: a; " + "x".repeat(61) + "; good skill");
    expect(out).toEqual(["good skill"]);
  });
});

describe("dedupeSkills", () => {
  it("dedupes case-insensitively and appends new", () => {
    expect(dedupeSkills(["SQL"], ["sql", "New Skill"])).toEqual(["SQL", "New Skill"]);
  });

  it("caps at 20", () => {
    const many = Array.from({ length: 25 }, (_, i) => `skill ${i}`);
    expect(dedupeSkills([], many)).toHaveLength(20);
  });
});

describe("studyRunMarker", () => {
  it("builds the marker", () => {
    expect(studyRunMarker("abc")).toBe("[fleet-study:abc]");
  });
});

describe("canPromoteToMentor", () => {
  const base = { lifecycle_stage: "worker" as const, run_count: 12, skills: ["a", "b", "c", "d", "e"] };
  it("approves a proven worker", () => {
    expect(canPromoteToMentor(base).ok).toBe(true);
  });
  it("rejects with reasons", () => {
    const r = canPromoteToMentor({ lifecycle_stage: "student", run_count: 2, skills: ["a"] });
    expect(r.ok).toBe(false);
    expect(r.reasons.length).toBe(3);
  });
});

describe("isTickableStage", () => {
  it("allows worker and mentor only", () => {
    expect(isTickableStage("worker")).toBe(true);
    expect(isTickableStage("mentor")).toBe(true);
    expect(isTickableStage("student")).toBe(false);
    expect(isTickableStage("applicant")).toBe(false);
    expect(isTickableStage("retired")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// School
// ---------------------------------------------------------------------------
describe("enrollStudent", () => {
  it("enrolls an applicant as student with a mentor", async () => {
    const mentor = agentRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Chief Executive",
      role: "ceo",
      lifecycle_stage: "mentor",
    });
    const applicant = agentRow();
    const { db } = buildStore({ manovik_agents: [applicant, mentor] });
    const out = (await enrollStudent(db, USER, applicant.id as string)) as unknown as Row;
    expect(out.lifecycle_stage).toBe("student");
    expect(out.mentor_id).toBe(mentor.id);
  });

  it("prefers a CEO mentor over other mentors", async () => {
    const other = agentRow({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Other Mentor",
      lifecycle_stage: "mentor",
      role: "cfo",
    });
    const ceo = agentRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Chief Executive",
      role: "ceo",
      lifecycle_stage: "mentor",
    });
    const applicant = agentRow();
    const { db } = buildStore({ manovik_agents: [applicant, other, ceo] });
    const out = (await enrollStudent(db, USER, applicant.id as string)) as unknown as Row;
    expect(out.mentor_id).toBe(ceo.id);
  });

  it("enrolls without a mentor when none exists", async () => {
    const applicant = agentRow();
    const { db } = buildStore({ manovik_agents: [applicant] });
    const out = (await enrollStudent(db, USER, applicant.id as string)) as unknown as Row;
    expect(out.lifecycle_stage).toBe("student");
    expect(out.mentor_id).toBeNull();
  });

  it("refuses non-applicants", async () => {
    const worker = agentRow({ lifecycle_stage: "worker" });
    const { db } = buildStore({ manovik_agents: [worker] });
    await expect(enrollStudent(db, USER, worker.id as string)).rejects.toThrow(/only applicants/i);
  });
});

describe("compileStudyPack", () => {
  it("includes doctrine, mentor craft, and role/job", async () => {
    const mentor = agentRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Chief Executive",
      job: "Lead the staff wisely.",
      lifecycle_stage: "mentor",
    });
    const student = agentRow({ lifecycle_stage: "student", mentor_id: mentor.id as string });
    const { db } = buildStore({
      manovik_agents: [student, mentor],
      manovik_brain_updates: [
        { version: "v2", notes: "New model released", created_at: new Date().toISOString() },
      ],
    });
    const pack = await compileStudyPack(db, USER, student as never);
    expect(pack).toContain("HOUSE DOCTRINE");
    expect(pack).toContain("New model released");
    expect(pack).toContain("Lead the staff wisely");
    expect(pack).toContain("YOUR FUTURE JOB");
  });
});

describe("teachStudent", () => {
  it("runs a study session and appends new skills", async () => {
    vi.mocked(runAgentJob).mockResolvedValue({
      ok: true,
      agentId: "x",
      status: "succeeded",
      summary: "Learned a lot.\nSKILLS: summarize security headers; draft retailer posts; brand-new skill",
      runId: "run-1",
    });
    const student = agentRow({ lifecycle_stage: "student", skills: ["summarize security headers"] });
    const { db, store } = buildStore({ manovik_agents: [student] });
    const { newSkills } = await teachStudent(db, USER, student.id as string);
    expect(newSkills).toEqual(["draft retailer posts", "brand-new skill"]);
    const row = store.get("manovik_agents")![0]!;
    expect(row.skills).toEqual([
      "summarize security headers",
      "draft retailer posts",
      "brand-new skill",
    ]);
    // Study mode was requested (not a regular job run).
    const call = vi.mocked(runAgentJob).mock.calls[0]!;
    expect(call[1]).toMatchObject({ userId: USER });
    expect(typeof (call[1] as { studyPack?: string }).studyPack).toBe("string");
  });

  it("throws when the study run fails", async () => {
    vi.mocked(runAgentJob).mockResolvedValue({
      ok: false,
      agentId: "x",
      status: "failed",
      summary: "boom",
    });
    const student = agentRow({ lifecycle_stage: "student" });
    const { db } = buildStore({ manovik_agents: [student] });
    await expect(teachStudent(db, USER, student.id as string)).rejects.toThrow(/study session failed/i);
  });

  it("refuses non-students", async () => {
    const worker = agentRow({ lifecycle_stage: "worker" });
    const { db } = buildStore({ manovik_agents: [worker] });
    await expect(teachStudent(db, USER, worker.id as string)).rejects.toThrow(/only students/i);
  });
});

describe("graduateStudent", () => {
  it("graduates a student with 3+ skills and a completed study session", async () => {
    const student = agentRow({
      lifecycle_stage: "student",
      skills: ["a", "b", "c"],
      schedule: "daily",
    });
    const { db } = buildStore({
      manovik_agents: [student],
      manovik_agi_runs: [
        {
          id: "run-1",
          user_id: USER,
          goal: `${studyRunMarker(student.id as string)} New Hire: study session`,
          status: "done",
        },
      ],
    });
    const out = (await graduateStudent(db, USER, student.id as string)) as unknown as Row;
    expect(out.lifecycle_stage).toBe("worker");
    expect(out.next_run_at).not.toBeNull();
  });

  it("refuses without 3 skills", async () => {
    const student = agentRow({ lifecycle_stage: "student", skills: ["a"] });
    const { db } = buildStore({ manovik_agents: [student] });
    await expect(graduateStudent(db, USER, student.id as string)).rejects.toThrow(/3 skills/);
  });

  it("refuses without a completed study session", async () => {
    const student = agentRow({ lifecycle_stage: "student", skills: ["a", "b", "c"] });
    const { db } = buildStore({
      manovik_agents: [student],
      manovik_agi_runs: [
        { id: "run-1", user_id: USER, goal: `${studyRunMarker(student.id as string)} x`, status: "failed" },
      ],
    });
    await expect(graduateStudent(db, USER, student.id as string)).rejects.toThrow(/study session/);
  });
});

describe("hasCompletedStudySession", () => {
  it("detects done study runs only", async () => {
    const { db } = buildStore({
      manovik_agi_runs: [{ id: "r1", user_id: USER, goal: "[fleet-study:abc] x", status: "done" }],
    });
    expect(await hasCompletedStudySession(db, USER, "abc")).toBe(true);
    expect(await hasCompletedStudySession(db, USER, "zzz")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Proposals: god-console approvals
// ---------------------------------------------------------------------------
describe("listProposals", () => {
  it("lists pending with proposer names", async () => {
    const proposer = agentRow({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Chief Executive",
    });
    const p = proposalRow();
    const { db } = buildStore({ manovik_agent_proposals: [p], manovik_agents: [proposer] });
    const rows = await listProposals(db, USER, "pending");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.proposer_name).toBe("Chief Executive");
  });

  it("returns [] when the table is missing (fail-closed)", async () => {
    const { db } = buildStore({});
    // Simulate missing table by deleting it from the store mid-flight:
    // our fake has no error injection, so this just asserts empty seed → [].
    expect(await listProposals(db, USER, "pending")).toEqual([]);
  });
});

describe("approveProposal", () => {
  it("creates the agent as applicant, enrolls as student, marks approved", async () => {
    const proposer = agentRow({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Chief Executive",
      lifecycle_stage: "mentor",
    });
    const p = proposalRow();
    const { db, store } = buildStore({
      manovik_agents: [proposer],
      manovik_agent_proposals: [p],
    });
    const { agent, proposal } = await approveProposal(db, USER, p.id as string);
    const a = agent as unknown as Row;
    expect(a.lifecycle_stage).toBe("student");
    expect(a.proposed_by).toBe(proposer.id);
    expect(a.name).toBe("Dream Hire");
    expect((proposal as unknown as Row).status).toBe("approved");
    expect((proposal as unknown as Row).decided_at).not.toBeNull();
    // The inserted agent row exists in the store.
    const created = store
      .get("manovik_agents")!
      .find((r) => r.name === "Dream Hire")!;
    expect(created).toBeDefined();
    expect(created.lifecycle_stage).toBe("student");
  });

  it("refuses already-decided proposals", async () => {
    const p = proposalRow({ status: "approved" });
    const { db } = buildStore({ manovik_agent_proposals: [p] });
    await expect(approveProposal(db, USER, p.id as string)).rejects.toThrow(/already approved/);
  });

  it("refuses unknown proposals", async () => {
    const { db } = buildStore({ manovik_agent_proposals: [] });
    await expect(
      approveProposal(db, USER, "99999999-9999-4999-8999-999999999999"),
    ).rejects.toThrow(/not found/i);
  });
});

describe("rejectProposal", () => {
  it("rejects with a stored reason", async () => {
    const p = proposalRow();
    const { db, store } = buildStore({ manovik_agent_proposals: [p] });
    const out = (await rejectProposal(db, USER, p.id as string, "Not needed now")) as unknown as Row;
    expect(out.status).toBe("rejected");
    expect(out.decision_note).toBe("Not needed now");
    expect(store.get("manovik_agent_proposals")![0]!.status).toBe("rejected");
  });

  it("requires a reason", async () => {
    const p = proposalRow();
    const { db } = buildStore({ manovik_agent_proposals: [p] });
    await expect(rejectProposal(db, USER, p.id as string, "  ")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------
describe("promoteToMentor", () => {
  it("promotes a proven worker", async () => {
    const worker = agentRow({
      lifecycle_stage: "worker",
      run_count: 12,
      skills: ["a", "b", "c", "d", "e"],
    });
    const { db } = buildStore({ manovik_agents: [worker] });
    const out = (await promoteToMentor(db, USER, worker.id as string)) as unknown as Row;
    expect(out.lifecycle_stage).toBe("mentor");
  });

  it("refuses an unproven worker", async () => {
    const worker = agentRow({ lifecycle_stage: "worker", run_count: 2, skills: ["a"] });
    const { db } = buildStore({ manovik_agents: [worker] });
    await expect(promoteToMentor(db, USER, worker.id as string)).rejects.toThrow(/not ready to mentor/);
  });
});

describe("retireAgent", () => {
  it("retires a worker and pauses it", async () => {
    const worker = agentRow({ lifecycle_stage: "worker", status: "active" });
    const { db } = buildStore({ manovik_agents: [worker] });
    const out = (await retireAgent(db, USER, worker.id as string, "Role obsolete")) as unknown as Row;
    expect(out.lifecycle_stage).toBe("retired");
    expect(out.status).toBe("paused");
  });

  it("refuses students and requires a reason", async () => {
    const student = agentRow({ lifecycle_stage: "student" });
    const { db } = buildStore({ manovik_agents: [student] });
    await expect(retireAgent(db, USER, student.id as string, "x")).rejects.toThrow(/only workers or mentors/i);
    const worker = agentRow({ lifecycle_stage: "worker" });
    const { db: db2 } = buildStore({ manovik_agents: [worker] });
    await expect(retireAgent(db2, USER, worker.id as string, "")).rejects.toThrow(/reason/i);
  });
});
