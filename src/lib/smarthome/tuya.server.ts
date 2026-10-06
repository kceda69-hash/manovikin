// Server-only Tuya Cloud (Smart Life) smart-home integration.
//
// SECURITY: raw credential values (client secrets, tokens) are NEVER logged,
// never included in error messages, and never returned to callers. Only masked
// identifiers (e.g. "…abcd") may leave this module.
import { createHash, createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const NOT_LINKED_MESSAGE =
  "Smart home not linked — open /home to link your Tuya/Smart Life account.";

// ---------------------------------------------------------------------------
// Pure signing helpers (exported for tests). Implements Tuya's "Sign" spec:
//   sign = HMAC-SHA256(clientId + accessToken + t + stringToSign, secret)
//   stringToSign = HTTPMethod + "\n" + Content-SHA256 + "\n" + "\n" + URL
// where Content-SHA256 is the lowercase hex SHA-256 of the request body
// (empty string for GETs) and URL is path + query string (no host).
// The sign and t are sent as headers alongside client_id and sign_method.
// ---------------------------------------------------------------------------

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function buildStringToSign(method: string, pathWithQuery: string, body = ""): string {
  return `${method.toUpperCase()}\n${sha256Hex(body)}\n\n${pathWithQuery}`;
}

export function computeSign(args: {
  clientId: string;
  token?: string;
  t: string | number;
  stringToSign: string;
  secret: string;
}): string {
  const { clientId, token = "", t, stringToSign, secret } = args;
  return createHmac("sha256", secret)
    .update(`${clientId}${token}${t}${stringToSign}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

export interface SignRequestParams {
  method: string;
  /** Full URL (host + path + query); only path+query enter the signature. */
  url: string;
  body?: string;
  clientId: string;
  secret: string;
  /** Access token — empty for the /v1.0/token grant call. */
  token?: string;
  /** Override the timestamp (tests / retries); defaults to Date.now(). */
  t?: string | number;
}

export function signRequest(params: SignRequestParams): {
  t: string;
  sign: string;
  signMethod: "HMAC-SHA256";
} {
  const t = String(params.t ?? Date.now());
  const parsed = new URL(params.url);
  const stringToSign = buildStringToSign(
    params.method,
    parsed.pathname + parsed.search,
    params.body ?? "",
  );
  const sign = computeSign({
    clientId: params.clientId,
    token: params.token ?? "",
    t,
    stringToSign,
    secret: params.secret,
  });
  return { t, sign, signMethod: "HMAC-SHA256" };
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

const REGION_HOSTS: Record<string, string> = {
  us: "https://openapi.tuyaus.com",
  eu: "https://openapi.tuyaeu.com",
  in: "https://openapi.tuyain.com",
  cn: "https://openapi.tuyacn.com",
};

export const TUYA_REGIONS = Object.keys(REGION_HOSTS);

export function baseUrlForRegion(region?: string): string {
  const r = (region ?? "us").toLowerCase();
  return REGION_HOSTS[r] ?? REGION_HOSTS.us;
}

// ---------------------------------------------------------------------------
// Tuya HTTP layer
// ---------------------------------------------------------------------------

interface TuyaEnvelope<T = unknown> {
  success: boolean;
  code?: string | number;
  msg?: string;
  result?: T;
}

/** Error message that never carries credential values — only Tuya's code/msg. */
function tuyaErrorMessage(envelope: TuyaEnvelope | null, fallback: string): string {
  if (envelope && typeof envelope === "object") {
    const code = envelope.code ?? "unknown";
    const msg = envelope.msg ? String(envelope.msg).slice(0, 200) : fallback;
    return `Tuya API error (${code}): ${msg}`;
  }
  return fallback;
}

interface TuyaCredentials {
  clientId: string;
  clientSecret: string;
  region: string;
  uid: string;
}

interface TokenGrantResult {
  access_token: string;
  refresh_token: string;
  expire_time: number;
  uid: string;
}

async function requestToken(
  clientId: string,
  secret: string,
  baseUrl: string,
): Promise<{ accessToken: string; refreshToken: string; expireTime: number; uid: string }> {
  const path = "/v1.0/token?grant_type=1";
  const { t, sign, signMethod } = signRequest({
    method: "POST",
    url: baseUrl + path,
    body: "",
    clientId,
    secret,
  });
  const res = await fetch(baseUrl + path, {
    method: "POST",
    headers: { client_id: clientId, sign, t, sign_method: signMethod },
  });
  let data: TuyaEnvelope<TokenGrantResult> | null = null;
  try {
    data = (await res.json()) as TuyaEnvelope<TokenGrantResult>;
  } catch {
    data = null;
  }
  if (!data?.success || !data.result?.access_token) {
    throw new Error(tuyaErrorMessage(data, "Failed to get Tuya access token"));
  }
  return {
    accessToken: data.result.access_token,
    refreshToken: data.result.refresh_token,
    expireTime: data.result.expire_time,
    uid: data.result.uid,
  };
}

async function tuyaGet<T>(
  baseUrl: string,
  path: string,
  creds: TuyaCredentials,
  token: string,
): Promise<TuyaEnvelope<T>> {
  const { t, sign, signMethod } = signRequest({
    method: "GET",
    url: baseUrl + path,
    body: "",
    clientId: creds.clientId,
    secret: creds.clientSecret,
    token,
  });
  const res = await fetch(baseUrl + path, {
    method: "GET",
    headers: {
      client_id: creds.clientId,
      access_token: token,
      sign,
      t,
      sign_method: signMethod,
    },
  });
  let data: TuyaEnvelope<T> | null = null;
  try {
    data = (await res.json()) as TuyaEnvelope<T>;
  } catch {
    data = null;
  }
  if (!data?.success) throw new Error(tuyaErrorMessage(data, `Tuya GET ${path} failed`));
  return data;
}

async function tuyaPost<T>(
  baseUrl: string,
  path: string,
  payload: unknown,
  creds: TuyaCredentials,
  token: string,
): Promise<TuyaEnvelope<T>> {
  const body = JSON.stringify(payload);
  const { t, sign, signMethod } = signRequest({
    method: "POST",
    url: baseUrl + path,
    body,
    clientId: creds.clientId,
    secret: creds.clientSecret,
    token,
  });
  const res = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      client_id: creds.clientId,
      access_token: token,
      sign,
      t,
      sign_method: signMethod,
    },
    body,
  });
  let data: TuyaEnvelope<T> | null = null;
  try {
    data = (await res.json()) as TuyaEnvelope<T>;
  } catch {
    data = null;
  }
  if (!data?.success) throw new Error(tuyaErrorMessage(data, `Tuya POST ${path} failed`));
  return data;
}

/** Public token fetch (default region us; eu/in/cn supported via region). */
export async function getToken(
  clientId: string,
  secret: string,
  region = "us",
): Promise<{ accessToken: string; expireTime: number }> {
  const token = await requestToken(clientId, secret, baseUrlForRegion(region));
  return { accessToken: token.accessToken, expireTime: token.expireTime };
}

// ---------------------------------------------------------------------------
// Credential storage — manovik_user_integrations (service-role only).
// The table is not in the auto-generated Database types, so this boundary uses
// a minimal local row type instead of editing the generated file.
// ---------------------------------------------------------------------------

interface IntegrationRow {
  user_id: string;
  provider: string;
  credentials: TuyaCredentials;
  linked_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = supabaseAdmin as any;

async function loadCreds(userId: string): Promise<TuyaCredentials | null> {
  const { data, error } = await adminDb
    .from("manovik_user_integrations")
    .select("credentials")
    .eq("user_id", userId)
    .eq("provider", "tuya")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { credentials?: TuyaCredentials } | null;
  return row?.credentials ?? null;
}

async function requireCreds(userId: string): Promise<TuyaCredentials> {
  const creds = await loadCreds(userId);
  if (!creds) throw new Error(NOT_LINKED_MESSAGE);
  return creds;
}

export function maskClientId(clientId: string): string {
  const id = String(clientId ?? "");
  return id.length <= 4 ? "…••••" : `…${id.slice(-4)}`;
}

export async function isLinked(userId: string): Promise<boolean> {
  return (await loadCreds(userId)) !== null;
}

export async function unlinkAccount(userId: string): Promise<{ ok: true }> {
  const { error } = await adminDb
    .from("manovik_user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "tuya");
  if (error) throw new Error(error.message);
  return { ok: true };
}

export interface LinkInput {
  clientId: string;
  clientSecret: string;
  region?: string;
  uid: string;
}

export async function linkAccount(
  userId: string,
  input: LinkInput,
): Promise<{ ok: true; maskedClientId: string }> {
  const creds: TuyaCredentials = {
    clientId: String(input.clientId ?? "").trim(),
    clientSecret: String(input.clientSecret ?? "").trim(),
    region: String(input.region ?? "us").trim().toLowerCase(),
    uid: String(input.uid ?? "").trim(),
  };
  if (!creds.clientId || !creds.clientSecret || !creds.uid) {
    throw new Error("Client ID, Client Secret and UID are all required.");
  }
  if (!REGION_HOSTS[creds.region]) {
    throw new Error(`Unknown region — use one of: ${TUYA_REGIONS.join(", ")}.`);
  }
  const baseUrl = baseUrlForRegion(creds.region);
  // Validate the credentials end-to-end before storing anything.
  const token = await requestToken(creds.clientId, creds.clientSecret, baseUrl);
  await tuyaGet(
    baseUrl,
    `/v1.0/users/${encodeURIComponent(creds.uid)}/devices?limit=1`,
    creds,
    token.accessToken,
  );
  // Validation passed — persist. Secrets live only in this jsonb column.
  const { error } = await adminDb
    .from("manovik_user_integrations")
    .upsert(
      {
        user_id: userId,
        provider: "tuya",
        credentials: creds,
        updated_at: new Date().toISOString(),
      } as IntegrationRow,
      { onConflict: "user_id,provider" },
    );
  if (error) throw new Error(error.message);
  return { ok: true, maskedClientId: maskClientId(creds.clientId) };
}

export async function linkStatus(userId: string): Promise<{
  linked: boolean;
  maskedClientId: string | null;
  region: string | null;
  linkedAt: string | null;
}> {
  const { data, error } = await adminDb
    .from("manovik_user_integrations")
    .select("credentials, linked_at")
    .eq("user_id", userId)
    .eq("provider", "tuya")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Pick<IntegrationRow, "credentials" | "linked_at"> | null;
  if (!row) return { linked: false, maskedClientId: null, region: null, linkedAt: null };
  return {
    linked: true,
    maskedClientId: maskClientId(row.credentials.clientId),
    region: row.credentials.region,
    linkedAt: row.linked_at,
  };
}

// ---------------------------------------------------------------------------
// Devices & commands
// ---------------------------------------------------------------------------

export interface HomeDevice {
  id: string;
  name: string;
  category: string;
  online: boolean;
  status: Record<string, unknown>;
}

interface TuyaDevice {
  id: string;
  name?: string;
  category?: string;
  online?: boolean;
  status?: Array<{ code: string; value: unknown }>;
}

export async function listDevices(userId: string): Promise<HomeDevice[]> {
  const creds = await requireCreds(userId);
  const baseUrl = baseUrlForRegion(creds.region);
  const token = await requestToken(creds.clientId, creds.clientSecret, baseUrl);
  const data = await tuyaGet<{ devices?: TuyaDevice[] }>(
    baseUrl,
    `/v1.0/users/${encodeURIComponent(creds.uid)}/devices`,
    creds,
    token.accessToken,
  );
  const devices = data.result?.devices ?? [];
  return devices.map((d) => ({
    id: String(d.id),
    name: String(d.name ?? d.id),
    category: String(d.category ?? ""),
    online: d.online === true,
    status: Object.fromEntries((d.status ?? []).map((s) => [String(s.code), s.value])),
  }));
}

export type HomeAction = "on" | "off" | "toggle" | "brightness" | "color_temp";

export const HOME_ACTIONS: HomeAction[] = ["on", "off", "toggle", "brightness", "color_temp"];

/** Map a MANO action to a Tuya command payload. Exported pure for tests. */
export function buildCommandPayload(
  action: HomeAction,
  value?: number,
): { code: string; value: boolean | number } {
  switch (action) {
    case "on":
      return { code: "switch_led", value: true };
    case "off":
      return { code: "switch_led", value: false };
    case "brightness": {
      const v = Math.round(Number(value));
      if (!Number.isFinite(v)) throw new Error("brightness needs a value between 10 and 1000.");
      return { code: "bright_value_v2", value: Math.min(1000, Math.max(10, v)) };
    }
    case "color_temp": {
      const v = Math.round(Number(value));
      if (!Number.isFinite(v)) throw new Error("color_temp needs a value between 0 and 1000.");
      return { code: "temp_value_v2", value: Math.min(1000, Math.max(0, v)) };
    }
    case "toggle":
      throw new Error("toggle needs the current device state — handled by sendCommand.");
    default:
      throw new Error(`Unknown action "${String(action)}".`);
  }
}

async function readSwitchState(
  baseUrl: string,
  deviceId: string,
  creds: TuyaCredentials,
  token: string,
): Promise<boolean> {
  const data = await tuyaGet<Array<{ code: string; value: unknown }>>(
    baseUrl,
    `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/status`,
    creds,
    token,
  );
  const statuses = data.result ?? [];
  const sw = statuses.find((s) => String(s.code).toLowerCase().includes("switch"));
  return sw?.value === true;
}

export async function sendCommand(
  userId: string,
  deviceId: string,
  action: HomeAction,
  value?: number,
): Promise<{ ok: true; message: string }> {
  const creds = await requireCreds(userId);
  if (!deviceId || !String(deviceId).trim()) throw new Error("deviceId is required.");
  const baseUrl = baseUrlForRegion(creds.region);
  const token = await requestToken(creds.clientId, creds.clientSecret, baseUrl);

  let payload: { code: string; value: boolean | number };
  let verb: string;
  if (action === "toggle") {
    const isOn = await readSwitchState(baseUrl, deviceId, creds, token.accessToken);
    payload = { code: "switch_led", value: !isOn };
    verb = isOn ? "off" : "on";
  } else {
    payload = buildCommandPayload(action, value);
    verb =
      action === "brightness"
        ? `brightness to ${payload.value}`
        : action === "color_temp"
          ? `color temperature to ${payload.value}`
          : action;
  }

  await tuyaPost(
    baseUrl,
    `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`,
    { commands: [payload] },
    creds,
    token.accessToken,
  );
  // FIX (agent-safety audit): smart-home actions are audit-logged.
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "home.command",
    summary: `Smart-home command: ${action} on device ${deviceId.slice(0, 8)}…`,
    metadata: { deviceId, action, value },
  });
  return { ok: true, message: `Turned ${verb}.` };
}
