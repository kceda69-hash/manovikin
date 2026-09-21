import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deleteThreadInput, getThreadMessagesInput } from "@/lib/chat.functions";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const BAD_INPUTS: unknown[] = [
  "",
  "not-a-uuid",
  "1; DROP TABLE threads;--",
  "1111",
  "11111111-1111-1111-1111-11111111111", // 1 char short
  "11111111-1111-1111-1111-1111111111111", // 1 char long
  "../../etc/passwd",
  "<script>alert(1)</script>",
  null,
  undefined,
  123,
  {},
  [],
];

describe("deleteThread UUID validation", () => {
  it("accepts a valid UUID", () => {
    expect(() => deleteThreadInput.parse({ id: VALID_UUID })).not.toThrow();
  });

  it.each(BAD_INPUTS)("rejects bad id: %p", (bad) => {
    expect(() => deleteThreadInput.parse({ id: bad })).toThrow();
  });

  it("rejects missing id field", () => {
    expect(() => deleteThreadInput.parse({})).toThrow();
  });

  it("rejects extra/missing shape", () => {
    expect(() => deleteThreadInput.parse(null)).toThrow();
    expect(() => deleteThreadInput.parse("string")).toThrow();
  });
});

describe("getThreadMessages UUID validation", () => {
  it("accepts a valid threadId", () => {
    expect(() => getThreadMessagesInput.parse({ threadId: VALID_UUID })).not.toThrow();
  });

  it.each(BAD_INPUTS)("rejects bad threadId: %p", (bad) => {
    expect(() => getThreadMessagesInput.parse({ threadId: bad })).toThrow();
  });

  it("rejects swapped field name (id instead of threadId)", () => {
    expect(() => getThreadMessagesInput.parse({ id: VALID_UUID })).toThrow();
  });
});

/**
 * Source-level regression guards: ensure the server functions stay
 * gated by requireSupabaseAuth and route input through the zod UUID
 * schemas. If someone accidentally drops the middleware or replaces
 * the validator with a pass-through, these tests fail loudly.
 */
describe("chat.functions.ts wiring", () => {
  const source = readFileSync(resolve(process.cwd(), "src/lib/chat.functions.ts"), "utf8");

  it("imports requireSupabaseAuth", () => {
    expect(source).toMatch(
      /import\s+\{\s*requireSupabaseAuth\s*\}\s+from\s+["']@\/integrations\/supabase\/auth-middleware["']/,
    );
  });

  it("guards deleteThread with requireSupabaseAuth", () => {
    const block = source.match(/export const deleteThread =[\s\S]*?\}\);/)?.[0];
    expect(block, "deleteThread block not found").toBeTruthy();
    expect(block!).toContain(".middleware([requireSupabaseAuth])");
    expect(block!).toMatch(/deleteThreadInput\.parse/);
  });

  it("guards getThreadMessages with requireSupabaseAuth", () => {
    const block = source.match(/export const getThreadMessages =[\s\S]*?\}\);/)?.[0];
    expect(block, "getThreadMessages block not found").toBeTruthy();
    expect(block!).toContain(".middleware([requireSupabaseAuth])");
    expect(block!).toMatch(/getThreadMessagesInput\.parse/);
  });

  it("does not leak raw db error messages", () => {
    expect(source).not.toMatch(/throw new Error\(\s*error\.message\s*\)/);
  });
});
