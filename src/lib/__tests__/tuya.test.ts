import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { sandbox } from "@/lib/agent-tools";

// Mock only isLinked (DB-backed); keep the real signing, payload builder,
// listDevices and sendCommand so the tool tests exercise the full path.
// Supabase itself is stubbed below so no env or network is needed.
const toolMocks = vi.hoisted(() => ({ isLinked: vi.fn() }));

vi.mock("@/lib/smarthome/tuya.server", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/smarthome/tuya.server")>();
  return { ...orig, isLinked: toolMocks.isLinked };
});

const dbState = vi.hoisted(() => ({
  creds: null as null | {
    clientId: string;
    clientSecret: string;
    region: string;
    uid: string;
  },
}));

vi.mock("@/integrations/supabase/client.server", () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.delete = self;
  chain.upsert = () => Promise.resolve({ data: null, error: null });
  chain.maybeSingle = () =>
    Promise.resolve(
      dbState.creds
        ? { data: { credentials: dbState.creds }, error: null }
        : { data: null, error: null },
    );
  return { supabaseAdmin: { from: () => chain } };
});

import {
  sha256Hex,
  buildStringToSign,
  computeSign,
  signRequest,
  buildCommandPayload,
  maskClientId,
  baseUrlForRegion,
  TUYA_REGIONS,
  NOT_LINKED_MESSAGE,
  listDevices,
  sendCommand,
} from "@/lib/smarthome/tuya.server";

const user = "test-user";

const TEST_CREDS = {
  clientId: "testClientId123",
  clientSecret: "testClientSecret456",
  region: "us",
  uid: "uid-abc",
};

// --- fetch mock -----------------------------------------------------------

type FetchHandler = (url: string, init: RequestInit) => unknown;

function stubFetch(handler: FetchHandler) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const body = handler(url, init);
      return { ok: true, json: async () => body };
    }),
  );
  return calls;
}

const TOKEN_OK = {
  success: true,
  result: {
    access_token: "tok-1",
    refresh_token: "ref-1",
    expire_time: 7200,
    uid: "uid-abc",
  },
};

const DEVICES_OK = {
  success: true,
  result: {
    devices: [
      {
        id: "dev-1",
        name: "Bedroom Light",
        category: "dj",
        online: true,
        status: [{ code: "switch_led", value: true }],
      },
      {
        id: "dev-2",
        name: "Desk Plug",
        category: "cz",
        online: false,
        status: [{ code: "switch_1", value: false }],
      },
    ],
  },
};

beforeEach(() => {
  dbState.creds = { ...TEST_CREDS };
  toolMocks.isLinked.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// --- signing ----------------------------------------------------------------

describe("tuya signing", () => {
  it("sha256Hex matches node:crypto for a fixed vector", () => {
    const expected = createHash("sha256").update("hello", "utf8").digest("hex");
    expect(sha256Hex("hello")).toBe(expected);
    // well-known SHA-256 of the empty string
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("buildStringToSign follows the Tuya Sign format", () => {
    const s = buildStringToSign("post", "/v1.0/token?grant_type=1", "");
    expect(s).toBe(`POST\n${sha256Hex("")}\n\n/v1.0/token?grant_type=1`);
    expect(buildStringToSign("get", "/x", "body")).toBe(`GET\n${sha256Hex("body")}\n\n/x`);
  });

  it("computeSign matches an independently computed HMAC-SHA256", () => {
    const args = {
      clientId: "cid",
      token: "tok",
      t: "1700000000000",
      stringToSign: "POST\nabc\n\n/v1.0/token?grant_type=1",
      secret: "sekret",
    };
    const expected = createHmac("sha256", args.secret)
      .update(`${args.clientId}${args.token}${args.t}${args.stringToSign}`, "utf8")
      .digest("hex")
      .toUpperCase();
    expect(computeSign(args)).toBe(expected);
  });

  it("signatures are deterministic, 64 uppercase hex chars, secret-sensitive", () => {
    const params = {
      method: "GET",
      url: "https://openapi.tuyaus.com/v1.0/users/uid/devices",
      clientId: "cid",
      secret: "sekret",
      token: "tok",
      t: 1700000000000,
    };
    const a = signRequest(params);
    const b = signRequest(params);
    expect(a.sign).toBe(b.sign);
    expect(a.sign).toMatch(/^[0-9A-F]{64}$/);
    expect(a.t).toBe("1700000000000");
    expect(a.signMethod).toBe("HMAC-SHA256");
    const other = signRequest({ ...params, secret: "different" });
    expect(other.sign).not.toBe(a.sign);
  });

  it("token grant omits the access token from the signature base", () => {
    const withEmpty = signRequest({
      method: "POST",
      url: "https://openapi.tuyaus.com/v1.0/token?grant_type=1",
      body: "",
      clientId: "cid",
      secret: "sekret",
      t: 1,
    });
    const expected = createHmac("sha256", "sekret")
      .update(`cid${1}POST\n${sha256Hex("")}\n\n/v1.0/token?grant_type=1`, "utf8")
      .digest("hex")
      .toUpperCase();
    expect(withEmpty.sign).toBe(expected);
  });
});

describe("region hosts", () => {
  it("maps us/eu/in/cn and defaults to us", () => {
    expect(baseUrlForRegion("eu")).toBe("https://openapi.tuyaeu.com");
    expect(baseUrlForRegion("in")).toBe("https://openapi.tuyain.com");
    expect(baseUrlForRegion("cn")).toBe("https://openapi.tuyacn.com");
    expect(baseUrlForRegion()).toBe("https://openapi.tuyaus.com");
    expect(baseUrlForRegion("xx")).toBe("https://openapi.tuyaus.com");
    expect(TUYA_REGIONS).toEqual(expect.arrayContaining(["us", "eu", "in", "cn"]));
  });

  it("maskClientId never reveals the full id", () => {
    expect(maskClientId("abcdefghijklmnop")).toBe("…mnop");
    expect(maskClientId("abcdefghijklmnop")).not.toContain("abcdefghijkl");
  });
});

// --- command payload builder -------------------------------------------------

describe("buildCommandPayload", () => {
  it("maps on/off to switch_led", () => {
    expect(buildCommandPayload("on")).toEqual({ code: "switch_led", value: true });
    expect(buildCommandPayload("off")).toEqual({ code: "switch_led", value: false });
  });

  it("maps brightness to bright_value_v2 and clamps 10-1000", () => {
    expect(buildCommandPayload("brightness", 50)).toEqual({ code: "bright_value_v2", value: 50 });
    expect(buildCommandPayload("brightness", 5)).toEqual({ code: "bright_value_v2", value: 10 });
    expect(buildCommandPayload("brightness", 5000)).toEqual({
      code: "bright_value_v2",
      value: 1000,
    });
  });

  it("maps color_temp to temp_value_v2 and clamps 0-1000", () => {
    expect(buildCommandPayload("color_temp", 300)).toEqual({
      code: "temp_value_v2",
      value: 300,
    });
    expect(buildCommandPayload("color_temp", -20)).toEqual({
      code: "temp_value_v2",
      value: 0,
    });
  });

  it("requires a value for brightness/color_temp", () => {
    expect(() => buildCommandPayload("brightness")).toThrow(/value/i);
    expect(() => buildCommandPayload("color_temp")).toThrow(/value/i);
  });

  it("rejects toggle (needs live device state) and unknown actions", () => {
    expect(() => buildCommandPayload("toggle")).toThrow(/current device state/i);
    expect(() => buildCommandPayload("nonsense" as never)).toThrow(/unknown action/i);
  });
});

// --- HTTP layer with mocked fetch ---------------------------------------------

describe("listDevices (fetch mocked)", () => {
  it("normalizes Tuya devices", async () => {
    stubFetch((url) => {
      if (url.includes("/v1.0/token")) return TOKEN_OK;
      if (url.includes("/users/uid-abc/devices")) return DEVICES_OK;
      throw new Error(`unexpected url ${url}`);
    });
    const devices = await listDevices(user);
    expect(devices).toHaveLength(2);
    expect(devices[0]).toEqual({
      id: "dev-1",
      name: "Bedroom Light",
      category: "dj",
      online: true,
      status: { switch_led: true },
    });
    expect(devices[1].online).toBe(false);
  });

  it("throws the not-linked message when no credentials are stored", async () => {
    dbState.creds = null;
    stubFetch(() => TOKEN_OK);
    await expect(listDevices(user)).rejects.toThrow(NOT_LINKED_MESSAGE);
  });

  it("surfaces Tuya errors without leaking credentials", async () => {
    stubFetch((url) => {
      if (url.includes("/v1.0/token")) return { success: false, code: 1106, msg: "permission deny" };
      throw new Error(`unexpected url ${url}`);
    });
    await expect(listDevices(user)).rejects.toThrow(/Tuya API error \(1106\)/);
    await expect(listDevices(user)).rejects.not.toThrow(/testClientSecret456/);
  });
});

describe("sendCommand (fetch mocked)", () => {
  it("posts switch_led=false for off", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("/v1.0/token")) return TOKEN_OK;
      if (url.includes("/commands")) return { success: true, result: true };
      throw new Error(`unexpected url ${url}`);
    });
    const r = await sendCommand(user, "dev-1", "off");
    expect(r.ok).toBe(true);
    const cmdCall = calls.find((c) => c.url.includes("/commands"));
    expect(cmdCall).toBeDefined();
    expect(cmdCall!.init.method).toBe("POST");
    expect(JSON.parse(String(cmdCall!.init.body))).toEqual({
      commands: [{ code: "switch_led", value: false }],
    });
    // auth headers present, secret never in URL
    expect(cmdCall!.init.headers).toMatchObject({ client_id: "testClientId123" });
    expect(cmdCall!.url).not.toContain("testClientSecret456");
  });

  it("reads state first for toggle and flips it", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("/v1.0/token")) return TOKEN_OK;
      if (url.includes("/status")) return { success: true, result: [{ code: "switch_led", value: true }] };
      if (url.includes("/commands")) return { success: true, result: true };
      throw new Error(`unexpected url ${url}`);
    });
    const r = await sendCommand(user, "dev-1", "toggle");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/off/i);
    const cmdCall = calls.find((c) => c.url.includes("/commands"));
    expect(JSON.parse(String(cmdCall!.init.body))).toEqual({
      commands: [{ code: "switch_led", value: false }],
    });
  });

  it("sends brightness payload for brightness", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("/v1.0/token")) return TOKEN_OK;
      if (url.includes("/commands")) return { success: true, result: true };
      throw new Error(`unexpected url ${url}`);
    });
    await sendCommand(user, "dev-1", "brightness", 420);
    const cmdCall = calls.find((c) => c.url.includes("/commands"));
    expect(JSON.parse(String(cmdCall!.init.body))).toEqual({
      commands: [{ code: "bright_value_v2", value: 420 }],
    });
  });
});

// --- sandbox tools -----------------------------------------------------------

describe("home.list_devices tool", () => {
  it("tells the user to open /home when unlinked", async () => {
    toolMocks.isLinked.mockResolvedValue(false);
    const r = await sandbox.run("home.list_devices", {}, user);
    expect(r.ok).toBe(true);
    const o = r.output as { linked: boolean; message: string };
    expect(o.linked).toBe(false);
    expect(o.message).toBe(NOT_LINKED_MESSAGE);
    expect(o.message).toContain("/home");
  });

  it("returns normalized devices when linked", async () => {
    stubFetch((url) => {
      if (url.includes("/v1.0/token")) return TOKEN_OK;
      if (url.includes("/users/uid-abc/devices")) return DEVICES_OK;
      throw new Error(`unexpected url ${url}`);
    });
    const r = await sandbox.run("home.list_devices", {}, user);
    expect(r.ok).toBe(true);
    const o = r.output as { linked: boolean; count: number; devices: Array<{ name: string }> };
    expect(o.linked).toBe(true);
    expect(o.count).toBe(2);
    expect(o.devices[0].name).toBe("Bedroom Light");
  });
});

describe("home.command tool", () => {
  it("tells the user to open /home when unlinked", async () => {
    toolMocks.isLinked.mockResolvedValue(false);
    const r = await sandbox.run("home.command", { deviceId: "dev-1", action: "off" }, user);
    expect(r.ok).toBe(true);
    const o = r.output as { linked: boolean; message: string };
    expect(o.linked).toBe(false);
    expect(o.message).toContain("/home");
  });

  it("sends the command when linked", async () => {
    stubFetch((url) => {
      if (url.includes("/v1.0/token")) return TOKEN_OK;
      if (url.includes("/commands")) return { success: true, result: true };
      throw new Error(`unexpected url ${url}`);
    });
    const r = await sandbox.run("home.command", { deviceId: "dev-1", action: "on" }, user);
    expect(r.ok).toBe(true);
    const o = r.output as { linked: boolean; ok: boolean; message: string };
    expect(o.linked).toBe(true);
    expect(o.ok).toBe(true);
  });
});
