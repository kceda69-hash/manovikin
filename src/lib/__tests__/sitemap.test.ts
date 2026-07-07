import { describe, expect, it } from "vitest";

import {
  buildSitemapEntriesFromRouteFiles,
  routeFilePathToPublicPath,
} from "@/lib/sitemap";

const actualRouteFiles = Object.keys(
  import.meta.glob("../../routes/**/*.{ts,tsx}"),
).map((filePath) => filePath.replace("../../routes/", "./"));

describe("sitemap route discovery", () => {
  it("converts TanStack route filenames into public paths", () => {
    expect(routeFilePathToPublicPath("./index.tsx")).toBe("/");
    expect(routeFilePathToPublicPath("./blog.ai-coding-agent-benchmark.tsx")).toBe(
      "/blog/ai-coding-agent-benchmark",
    );
    expect(routeFilePathToPublicPath("./[.mcp]/list-tools.ts")).toBe(
      "/.mcp/list-tools",
    );
    expect(
      routeFilePathToPublicPath("./[.well-known]/oauth-protected-resource.ts"),
    ).toBe("/.well-known/oauth-protected-resource");
    expect(routeFilePathToPublicPath("./receipt.$id.tsx")).toBeNull();
  });

  it("keeps every static crawler-visible route in the sitemap automatically", () => {
    const paths = buildSitemapEntriesFromRouteFiles(actualRouteFiles).map(
      (entry) => entry.path,
    );

    expect(paths).toEqual(
      expect.arrayContaining([
        "/seo",
        "/unsubscribe",
        "/vs-devin",
        "/.mcp/list-tools",
        "/.well-known/oauth-protected-resource",
      ]),
    );
  });

  it("keeps internal endpoints, callback routes, and dynamic placeholders out", () => {
    const paths = buildSitemapEntriesFromRouteFiles(actualRouteFiles).map(
      (entry) => entry.path,
    );

    expect(paths).not.toContain("/api/chat");
    expect(paths).not.toContain("/auth/callback");
    expect(paths).not.toContain("/email/unsubscribe");
    expect(paths).not.toContain("/lovable/email/auth/webhook");
    expect(paths).not.toContain("/receipt/$id");
    expect(paths).not.toContain("/sitemap.xml");
  });
});