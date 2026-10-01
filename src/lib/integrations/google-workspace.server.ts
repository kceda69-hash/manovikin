/**
 * Server-only Google Workspace integration (Gmail + Calendar) for MANO chat.
 *
 * Each user links their own Google account via OAuth (offline access). The
 * refresh token lives in manovik_user_integrations (provider
 * "google-workspace", service-role only — same vault as Tuya). Values are
 * never logged, never returned to the client.
 *
 * Needs two worker secrets (Nick sets these once):
 *   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
 * from a Google Cloud OAuth client with redirect URI
 *   https://manovik.in/api/integrations/google/callback
 *
 * IMPORTANT: Cloudflare Workers don't populate process.env — read config via
 * getServerEnv (see src/lib/server-env.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerEnv } from "@/lib/server-env";

export const GW_PROVIDER = "google-workspace";

/** Minimal scopes: read + send mail, read calendars, manage events. */
export const GW_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const NOT_LINKED_MESSAGE =
  "Google Workspace isn't linked. Link it from Account → Google Workspace first — then I can read mail and manage the calendar.";
export const NOT_CONFIGURED_MESSAGE =
  "Google Workspace isn't configured on the server yet (OAuth client missing).";

// The table is not in the auto-generated Database types; use a minimal row
// type like the Tuya module does.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = supabaseAdmin as any;

interface GwTokens {
  refresh_token: string;
  access_token?: string;
  expires_at?: number; // epoch ms
  scope?: string;
}

function oauthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = getServerEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getServerEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleWorkspaceConfigured(): boolean {
  return oauthConfig() !== null;
}

export function gwRedirectUri(): string {
  const origin = getServerEnv("APP_ORIGIN") ?? "https://manovik.in";
  return `${origin.replace(/\/$/, "")}/api/integrations/google/callback`;
}

/** Build the Google consent URL. `state` must be created by makeOAuthState(). */
export function buildConnectUrl(state: string): string {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(NOT_CONFIGURED_MESSAGE);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: gwRedirectUri(),
    response_type: "code",
    scope: GW_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Opaque state binding the OAuth round-trip to a user.
 * Format: `${userId}.${randomHex}` — the random part is also set as an
 * HttpOnly cookie; the callback requires both to match (CSRF protection).
 */
export function makeOAuthState(userId: string): { state: string; nonce: string } {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { state: `${userId}.${nonce}`, nonce };
}

export function parseOAuthState(
  state: string | null,
  cookieNonce: string | null,
): { userId: string } | null {
  if (!state || !cookieNonce) return null;
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = state.slice(0, dot);
  const nonce = state.slice(dot + 1);
  if (nonce !== cookieNonce) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  return { userId };
}

async function loadTokens(userId: string): Promise<GwTokens | null> {
  const { data, error } = await adminDb
    .from("manovik_user_integrations")
    .select("credentials")
    .eq("user_id", userId)
    .eq("provider", GW_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { credentials?: GwTokens } | null)?.credentials ?? null;
}

export async function saveWorkspaceTokens(
  userId: string,
  tokens: { refresh_token: string; access_token: string; expires_in: number; scope?: string },
): Promise<void> {
  const creds: GwTokens = {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
  };
  const { error } = await adminDb.from("manovik_user_integrations").upsert(
    {
      user_id: userId,
      provider: GW_PROVIDER,
      credentials: creds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function unlinkWorkspace(userId: string): Promise<void> {
  const { error } = await adminDb
    .from("manovik_user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", GW_PROVIDER);
  if (error) throw new Error(error.message);
}

export async function workspaceLinkStatus(
  userId: string,
): Promise<{ linked: boolean; linkedAt: string | null }> {
  const { data, error } = await adminDb
    .from("manovik_user_integrations")
    .select("linked_at")
    .eq("user_id", userId)
    .eq("provider", GW_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { linked: !!data, linkedAt: (data as { linked_at?: string } | null)?.linked_at ?? null };
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<GwTokens> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(NOT_CONFIGURED_MESSAGE);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
  const updated: GwTokens = {
    refresh_token: refreshToken,
    access_token: body.access_token,
    expires_at: Date.now() + body.expires_in * 1000,
    scope: body.scope,
  };
  await adminDb
    .from("manovik_user_integrations")
    .update({ credentials: updated, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", GW_PROVIDER);
  return updated;
}

/** True when the access token is missing or expires within the skew window. */
export function accessTokenExpired(tokens: GwTokens, now = Date.now()): boolean {
  if (!tokens.access_token || !tokens.expires_at) return true;
  return tokens.expires_at - now < 60_000;
}

/** Valid Google access token for the user, refreshing transparently. */
export async function getAccessToken(userId: string): Promise<string> {
  let tokens = await loadTokens(userId);
  if (!tokens) throw new Error(NOT_LINKED_MESSAGE);
  if (accessTokenExpired(tokens)) {
    tokens = await refreshAccessToken(userId, tokens.refresh_token);
  }
  if (!tokens.access_token) throw new Error("Google Workspace: could not obtain access token.");
  return tokens.access_token;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<{ refresh_token: string; access_token: string; expires_in: number; scope?: string }> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(NOT_CONFIGURED_MESSAGE);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: gwRedirectUri(),
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google code exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    refresh_token?: string;
    access_token: string;
    expires_in: number;
    scope?: string;
  };
  if (!body.refresh_token) {
    throw new Error("Google did not return a refresh token (access_type=offline required).");
  }
  return {
    refresh_token: body.refresh_token,
    access_token: body.access_token,
    expires_in: body.expires_in,
    scope: body.scope,
  };
}

type GwFetchOptions = {
  method?: string;
  body?: unknown;
};

/** Authorized Google API call with one transparent retry after refresh. */
export async function gwFetch(
  userId: string,
  url: string,
  options: GwFetchOptions = {},
): Promise<Response> {
  const doFetch = async (token: string) =>
    fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  let token = await getAccessToken(userId);
  let res = await doFetch(token);
  if (res.status === 401) {
    const tokens = await loadTokens(userId);
    if (!tokens) throw new Error(NOT_LINKED_MESSAGE);
    const refreshed = await refreshAccessToken(userId, tokens.refresh_token);
    token = refreshed.access_token!;
    res = await doFetch(token);
  }
  return res;
}

async function gwJson<T>(userId: string, url: string, options: GwFetchOptions = {}): Promise<T> {
  const res = await gwFetch(userId, url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API error (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ---- Gmail ----

export interface GwMessageMeta {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

function header(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Search mail (Gmail query syntax). Returns compact metadata, not bodies. */
export async function gwTriage(
  userId: string,
  query: string,
  max = 10,
): Promise<GwMessageMeta[]> {
  const list = await gwJson<{
    messages?: Array<{ id: string; threadId: string }>;
  }>(
    userId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(Math.max(max, 1), 25)}`,
  );
  const ids = (list.messages ?? []).slice(0, 25);
  const out: GwMessageMeta[] = [];
  for (const m of ids) {
    const full = await gwJson<{
      id: string;
      threadId: string;
      snippet: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    }>(
      userId,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    const headers = full.payload?.headers ?? [];
    out.push({
      id: full.id,
      threadId: full.threadId,
      from: header(headers, "From"),
      subject: header(headers, "Subject"),
      date: header(headers, "Date"),
      snippet: full.snippet ?? "",
    });
  }
  return out;
}

export interface GwMessageFull extends GwMessageMeta {
  body: string;
}

function extractBody(payload: unknown): string {
  // Walk MIME parts for the first text/plain (or text/html fallback) body.
  const texts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    };
    if (n.body?.data && (n.mimeType === "text/plain" || n.mimeType === "text/html")) {
      try {
        const bin = atob(n.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        texts.push(bin);
      } catch {
        /* ignore undecodable part */
      }
    }
    (n.parts ?? []).forEach(walk);
  };
  walk(payload);
  return texts.join("\n").slice(0, 20_000);
}

/** Read one message, full body included (plain text preferred). */
export async function gwReadMessage(userId: string, messageId: string): Promise<GwMessageFull> {
  const full = await gwJson<{
    id: string;
    threadId: string;
    snippet: string;
    payload?: { headers?: Array<{ name: string; value: string }> } & Record<string, unknown>;
  }>(userId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`);
  const headers = full.payload?.headers ?? [];
  return {
    id: full.id,
    threadId: full.threadId,
    from: header(headers, "From"),
    subject: header(headers, "Subject"),
    date: header(headers, "Date"),
    snippet: full.snippet ?? "",
    body: extractBody(full.payload),
  };
}

/** Build the base64url RFC 822 payload for messages.send. Pure — unit tested. */
export function buildSendRaw(to: string, subject: string, body: string): string {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Send a new message. Callers must confirm exact text with the user first. */
export async function gwSend(
  userId: string,
  args: { to: string; subject: string; body: string },
): Promise<{ id: string }> {
  const sent = await gwJson<{ id: string }>(
    userId,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    { method: "POST", body: { raw: buildSendRaw(args.to, args.subject, args.body) } },
  );
  return { id: sent.id };
}

// ---- Calendar ----

export interface GwEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

/** Agenda across all visible calendars in a time window. */
export async function gwAgenda(
  userId: string,
  timeMin: string,
  timeMax: string,
): Promise<GwEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "25",
  });
  const res = await gwJson<{ items?: Array<Record<string, unknown>> }>(
    userId,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
  );
  return (res.items ?? []).map((e) => ({
    id: String(e.id ?? ""),
    summary: String(e.summary ?? "(no title)"),
    start: String((e.start as Record<string, string> | undefined)?.dateTime ?? (e.start as Record<string, string> | undefined)?.date ?? ""),
    end: String((e.end as Record<string, string> | undefined)?.dateTime ?? (e.end as Record<string, string> | undefined)?.date ?? ""),
    location: (e.location as string | undefined) ?? undefined,
    attendees: ((e.attendees as Array<{ email?: string }> | undefined) ?? []).map((a) => a.email ?? "").filter(Boolean),
  }));
}

/** Create an event. Pure param builder — unit tested. */
export function buildEventBody(args: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}): Record<string, unknown> {
  const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(args.start) && /^\d{4}-\d{2}-\d{2}$/.test(args.end);
  const body: Record<string, unknown> = {
    summary: args.summary,
    start: isAllDay ? { date: args.start } : { dateTime: args.start },
    end: isAllDay ? { date: args.end } : { dateTime: args.end },
  };
  if (args.description) body.description = args.description;
  if (args.location) body.location = args.location;
  if (args.attendees?.length) body.attendees = args.attendees.map((email) => ({ email }));
  return body;
}

export async function gwCreateEvent(
  userId: string,
  args: {
    summary: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    attendees?: string[];
  },
): Promise<GwEvent> {
  const params = new URLSearchParams();
  if (args.attendees?.length) params.set("sendUpdates", "all");
  const e = await gwJson<Record<string, unknown>>(
    userId,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { method: "POST", body: buildEventBody(args) },
  );
  return {
    id: String(e.id ?? ""),
    summary: String(e.summary ?? ""),
    start: String((e.start as Record<string, string> | undefined)?.dateTime ?? ""),
    end: String((e.end as Record<string, string> | undefined)?.dateTime ?? ""),
  };
}

export async function gwDeleteEvent(userId: string, eventId: string): Promise<void> {
  const res = await gwFetch(
    userId,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 410) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API error (${res.status}): ${text.slice(0, 300)}`);
  }
}
