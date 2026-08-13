import { describe, expect, it } from "vitest";

import {
  FULLSTACK_DOCTRINE,
  fullstackDoctrineFor,
  isFullStackBuildRequest,
} from "@/lib/fullstack-doctrine";
import { routeModel } from "@/lib/model-router";

describe("full-stack doctrine detection", () => {
  it("fires on product build requests", () => {
    for (const p of [
      "build me a full stack SaaS dashboard with auth",
      "create a landing page for my bakery",
      "make an e-commerce website with a cart",
      "clone the Notion app UI",
      "I need a CRUD app with Supabase and React",
    ]) {
      expect(isFullStackBuildRequest(p), p).toBe(true);
    }
  });

  it("stays out of ordinary chat", () => {
    for (const p of ["hi", "what is the capital of France?", "explain closures", "thanks!"]) {
      expect(isFullStackBuildRequest(p), p).toBe(false);
    }
  });

  it("injects the doctrine only for build prompts", () => {
    expect(fullstackDoctrineFor("build a booking website")).toBe(FULLSTACK_DOCTRINE);
    expect(fullstackDoctrineFor("hello")).toBe("");
  });

  it("routes build prompts to the frontier coding tier", () => {
    const route = routeModel("build a marketplace website with payments");
    expect(route.tier).toBe("hard");
  });
});
