/**
 * Tests for the Ethical Hacking Lab web scanner (src/lib/seclab/webscan.server.ts).
 *
 * Covers the pure scoring logic, finding structure, SSRF blocking, and a
 * full mocked scan. The global fetch mock also stubs DNS-over-HTTPS like
 * the dossier tests do, since assertUrlSafe resolves via DoH.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCookieFlags,
  checkCors,
  checkSecurityHeaders,
  checkServerDisclosure,
  computeScore,
  webscanUrl,
  type SecFinding,
} from "@/lib/seclab/webscan.server";

function headers(obj: Record<string, string>): Headers {
  return new Headers(obj);
}

describe("computeScore", () => {
  it("starts at 100 with no findings", () => {
    expect(computeScore([])).toBe(100);
  });

  it("deducts 15/8/3/0 per severity and floors at 0", () => {
    const mk = (severity: SecFinding["severity"]): SecFinding => ({
      severity,
      check: "c",
      detail: "d",
      remediation: "r",
    });
    expect(computeScore([mk("high")])).toBe(85);
    expect(computeScore([mk("medium")])).toBe(92);
    expect(computeScore([mk("low")])).toBe(97);
    expect(computeScore([mk("info")])).toBe(100);
    expect(computeScore(Array(10).fill(mk("high")))).toBe(0);
  });
});

describe("checkSecurityHeaders", () => {
  it("flags every missing header on an https site", () => {
    const findings = checkSecurityHeaders({}, true);
    const checks = findings.map((f) => f.check);
    expect(checks).toContain("Content-Security-Policy");
    expect(checks).toContain("Strict-Transport-Security");
    expect(checks).toContain("X-Frame-Options");
    expect(checks).toContain("X-Content-Type-Options");
    expect(checks).toContain("Referrer-Policy");
    expect(checks).toContain("Permissions-Policy");
    expect(findings.find((f) => f.check === "Content-Security-Policy")?.severity).toBe("high");
  });

  it("passes a fully-hardened header set", () => {
    const findings = checkSecurityHeaders(
      {
        "content-security-policy": "default-src 'self'",
        "strict-transport-security": "max-age=31536000",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
      },
      true,
    );
    expect(findings).toHaveLength(0);
  });

  it("skips HSTS on plain http", () => {
    const findings = checkSecurityHeaders({}, false);
    expect(findings.map((f) => f.check)).not.toContain("Strict-Transport-Security");
  });

  it("accepts frame-ancestors CSP as clickjacking protection", () => {
    const findings = checkSecurityHeaders(
      { "content-security-policy": "default-src 'self'; frame-ancestors 'none'" },
      true,
    );
    expect(findings.map((f) => f.check)).not.toContain("X-Frame-Options");
  });
});

describe("checkCookieFlags", () => {
  it("reports info when no cookies are set", () => {
    const findings = checkCookieFlags([]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("info");
  });

  it("flags missing Secure/HttpOnly/SameSite per cookie", () => {
    const findings = checkCookieFlags(["session=abc; Path=/"]);
    expect(findings.some((f) => f.check === "Cookie Secure flag" && f.severity === "medium")).toBe(true);
    expect(findings.some((f) => f.check === "Cookie HttpOnly flag")).toBe(true);
    expect(findings.some((f) => f.check === "Cookie SameSite")).toBe(true);
  });

  it("passes a fully-flagged cookie", () => {
    const findings = checkCookieFlags(["session=abc; Path=/; Secure; HttpOnly; SameSite=Lax"]);
    expect(findings).toHaveLength(0);
  });
});

describe("checkServerDisclosure", () => {
  it("flags versioned Server and X-Powered-By headers", () => {
    const findings = checkServerDisclosure({
      server: "nginx/1.24.0",
      "x-powered-by": "Express",
    });
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === "low")).toBe(true);
  });

  it("ignores a generic Server header without version", () => {
    expect(checkServerDisclosure({ server: "cloudflare" })).toHaveLength(0);
  });
});

describe("checkCors", () => {
  it("flags wildcard + credentials as high", () => {
    const findings = checkCors({
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("high");
  });

  it("flags plain wildcard as medium", () => {
    const findings = checkCors({ "access-control-allow-origin": "*" });
    expect(findings[0]!.severity).toBe("medium");
  });

  it("passes a specific origin", () => {
    expect(checkCors({ "access-control-allow-origin": "https://app.example.com" })).toHaveLength(0);
  });
});

describe("webscanUrl (mocked fetch)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        // DNS-over-HTTPS stub for assertUrlSafe.
        if (url.includes("cloudflare-dns.com/dns-query")) {
          const name = new URL(url).searchParams.get("name") ?? "";
          const answers = name === "example.com" ? [{ type: 1, data: "93.184.216.34" }] : [];
          return new Response(JSON.stringify({ Answer: answers }), {
            status: 200,
            headers: { "content-type": "application/dns-json" },
          });
        }
        // Sensitive-path probes: .git exposed, .env not, server-status not.
        if (url.endsWith("/.git/HEAD")) {
          return new Response("", { status: 200 });
        }
        if (url.endsWith("/.env") || url.endsWith("/server-status")) {
          return new Response("", { status: 404 });
        }
        if (url.endsWith("/.well-known/security.txt")) {
          return new Response("", { status: 404 });
        }
        // Homepage: weak headers, one bad cookie, version disclosure.
        if (url === "https://example.com/" || url === "https://example.com") {
          const h = headers({
            server: "nginx/1.24.0",
            "content-type": "text/html",
          });
          h.append("set-cookie", "session=abc; Path=/");
          return new Response("<html></html>", { status: 200, headers: h });
        }
        throw new Error(`unexpected fetch: ${url} (${init?.method ?? "GET"})`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a structured report with score and findings", async () => {
    const report = await webscanUrl("https://example.com");
    expect(report.url).toBe("https://example.com");
    expect(report.score).toBeLessThan(100);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.findings)).toBe(true);
    for (const f of report.findings) {
      expect(["high", "medium", "low", "info"]).toContain(f.severity);
      expect(typeof f.check).toBe("string");
      expect(typeof f.detail).toBe("string");
      expect(typeof f.remediation).toBe("string");
    }
    // .git/HEAD returned 200 → high finding.
    expect(report.findings.some((f) => f.check === "Exposed .git directory" && f.severity === "high")).toBe(true);
    // Missing CSP → high finding.
    expect(report.findings.some((f) => f.check === "Content-Security-Policy")).toBe(true);
  });

  it("refuses private hosts (SSRF)", async () => {
    await expect(webscanUrl("http://localhost:9999/")).rejects.toThrow(/Blocked URL/);
    await expect(webscanUrl("http://192.168.1.1/")).rejects.toThrow(/Blocked URL/);
    await expect(webscanUrl("http://169.254.169.254/")).rejects.toThrow(/Blocked URL/);
  });

  it("flags plain http with a TLS high finding", async () => {
    // http://example.com is not a blocked host; the scan runs and flags TLS.
    // Mock only handles https homepage; make the mock answer http too.
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("cloudflare-dns.com/dns-query")) {
        return new Response(JSON.stringify({ Answer: [{ type: 1, data: "93.184.216.34" }] }), {
          status: 200,
          headers: { "content-type": "application/dns-json" },
        });
      }
      if (url.startsWith("http://example.com")) {
        return new Response("<html></html>", { status: 200, headers: headers({}) });
      }
      return new Response("", { status: 404 });
    });
    const report = await webscanUrl("http://example.com");
    expect(report.findings.some((f) => f.check === "TLS" && f.severity === "high")).toBe(true);
  });
});
