/**
 * Unit tests for the IP geolocation module and location tool schemas.
 * fetch is mocked — no network calls.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  clearGeoCache,
  geolocateIp,
  isPublicIp,
  isValidIp,
} from "@/lib/geolocation/geolocation.server";

const okResponse = (overrides: Record<string, unknown> = {}) =>
  ({
    ok: true,
    json: async () => ({
      status: "success",
      country: "United States",
      city: "Mountain View",
      lat: 37.386,
      lon: -122.0838,
      isp: "Google LLC",
      query: "8.8.8.8",
      ...overrides,
    }),
  }) as unknown as Response;

function mockFetch(response: Response | null, opts: { ok?: boolean } = {}) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: unknown) => {
    calls.push(String(url));
    if (!response) throw new Error("network down");
    return response;
  });
  return { fn: fn as unknown as typeof fetch, calls, opts };
}

beforeEach(() => {
  clearGeoCache();
});

describe("isValidIp", () => {
  it.each(["8.8.8.8", "1.1.1.1", "192.168.1.1", "2001:4860:4860::8888", "::1"])(
    "accepts %s",
    (ip) => expect(isValidIp(ip)).toBe(true),
  );
  it.each(["999.1.1.1", "example.com", "8.8.8", "", "1.2.3.4/24", "not an ip"])(
    "rejects %s",
    (ip) => expect(isValidIp(ip)).toBe(false),
  );
});

describe("isPublicIp", () => {
  it.each(["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888"])("accepts public %s", (ip) =>
    expect(isPublicIp(ip)).toBe(true),
  );
  it.each(["10.0.0.1", "172.16.5.4", "192.168.1.1", "127.0.0.1", "169.254.1.1", "::1", "fc00::1"])(
    "rejects private %s",
    (ip) => expect(isPublicIp(ip)).toBe(false),
  );
});

describe("geolocateIp", () => {
  it("parses a successful response", async () => {
    const { fn } = mockFetch(okResponse());
    const r = await geolocateIp("8.8.8.8", fn);
    expect(r).toEqual({
      ip: "8.8.8.8",
      country: "United States",
      city: "Mountain View",
      lat: 37.386,
      lon: -122.0838,
      isp: "Google LLC",
    });
  });

  it("returns null for private IPs without fetching", async () => {
    const { fn, calls } = mockFetch(okResponse());
    expect(await geolocateIp("192.168.1.1", fn)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("returns null for invalid IPs without fetching", async () => {
    const { fn, calls } = mockFetch(okResponse());
    expect(await geolocateIp("not-an-ip", fn)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("returns null when the API reports failure", async () => {
    const { fn } = mockFetch(okResponse({ status: "fail", message: "reserved range" }));
    expect(await geolocateIp("8.8.8.8", fn)).toBeNull();
  });

  it("returns null on network error", async () => {
    const { fn } = mockFetch(null);
    expect(await geolocateIp("8.8.8.8", fn)).toBeNull();
  });

  it("caches results (second call does not fetch)", async () => {
    const { fn, calls } = mockFetch(okResponse());
    await geolocateIp("8.8.8.8", fn);
    await geolocateIp("8.8.8.8", fn);
    expect(calls).toHaveLength(1);
  });

  it("does not cache failures as successes", async () => {
    const fail = mockFetch(null);
    expect(await geolocateIp("8.8.8.8", fail.fn)).toBeNull();
    clearGeoCache();
    const { fn } = mockFetch(okResponse());
    expect(await geolocateIp("8.8.8.8", fn)).not.toBeNull();
  });
});

describe("location tool schemas", () => {
  it("geo.ip schema rejects private and invalid IPs", async () => {
    const { locationTools } = await import("@/lib/location-tools");
    const geo = locationTools.find((t) => t.name === "geo.ip")!;
    expect(() => geo.schema.parse({ ip: "192.168.1.1" })).toThrow();
    expect(() => geo.schema.parse({ ip: "nope" })).toThrow();
    expect(geo.schema.parse({ ip: "8.8.8.8" })).toEqual({ ip: "8.8.8.8" });
  });

  it("device.locate schema requires a uuid", async () => {
    const { locationTools } = await import("@/lib/location-tools");
    const locate = locationTools.find((t) => t.name === "device.locate")!;
    expect(() => locate.schema.parse({ deviceId: "not-a-uuid" })).toThrow();
    expect(locate.schema.parse({ deviceId: "123e4567-e89b-12d3-a456-426614174000" })).toBeTruthy();
  });

  it("tools match the registry shape", async () => {
    const { locationTools } = await import("@/lib/location-tools");
    expect(locationTools).toHaveLength(2);
    for (const t of locationTools) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(typeof t.execute).toBe("function");
      expect(typeof t.timeoutMs).toBe("number");
    }
  });
});
