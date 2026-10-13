import { describe, expect, it } from "vitest";
import {
  GEMINI_FIRST_CHUNK_TIMEOUT_MS,
  FREE_GPT_FIRST_CHUNK_TIMEOUT_MS,
  GEMINI_CANDIDATE_COUNT,
  CLIENT_WATCHDOG_MS,
} from "@/routes/api/chat";

describe("chat failover timing invariant", () => {
  it("worst-case failover stays under the client watchdog", () => {
    const worstCase =
      GEMINI_CANDIDATE_COUNT * GEMINI_FIRST_CHUNK_TIMEOUT_MS +
      FREE_GPT_FIRST_CHUNK_TIMEOUT_MS;
    expect(worstCase).toBeLessThan(CLIENT_WATCHDOG_MS);
  });
});
