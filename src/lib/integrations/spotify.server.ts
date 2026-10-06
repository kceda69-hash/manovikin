/**
 * Server-only Spotify integration for MANO chat (the "voice DJ").
 *
 * Each user links their own Spotify account via OAuth. The refresh token
 * lives in manovik_user_integrations (provider "spotify", service-role only —
 * same vault as Google Workspace / Tuya). Values are never logged, never
 * returned to the client.
 *
 * Needs two worker secrets (Nick sets these once):
 *   SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
 * from a Spotify developer app with redirect URI
 *   https://manovik.in/api/integrations/spotify/callback
 *
 * Playback goes through Spotify Connect: the tools search, then play on the
 * user's active (or named) Connect device — phone, speaker, TV, desktop.
 * Starting playback requires Spotify Premium on the user's account; the API
 * says so explicitly (403 PREMIUM_REQUIRED) and we surface that plainly.
 *
 * IMPORTANT: Cloudflare Workers don't populate process.env — read config via
 * getServerEnv (see src/lib/server-env.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerEnv } from "@/lib/server-env";

export const SP_PROVIDER = "spotify";

/** Minimal scopes for a DJ: read state, control playback, build playlists. */
export const SP_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-modify-private",
  "user-top-read",
  "user-library-read",
];

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

export const SP_NOT_LINKED_MESSAGE =
  "Spotify isn't linked. Link it from Account → Spotify first — then I can DJ for you.";
export const SP_NOT_CONFIGURED_MESSAGE =
  "Spotify isn't configured on the server yet (OAuth app missing).";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = supabaseAdmin as any;

interface SpTokens {
  refresh_token: string;
  access_token?: string;
  expires_at?: number; // epoch ms
  scope?: string;
}

function oauthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = getServerEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getServerEnv("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isSpotifyConfigured(): boolean {
  return oauthConfig() !== null;
}

export function spRedirectUri(): string {
  const origin = getServerEnv("APP_ORIGIN") ?? "https://manovik.in";
  return `${origin.replace(/\/$/, "")}/api/integrations/spotify/callback`;
}

export function buildConnectUrl(state: string): string {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(SP_NOT_CONFIGURED_MESSAGE);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: spRedirectUri(),
    response_type: "code",
    scope: SP_SCOPES.join(" "),
    state,
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/** Same user-bound state scheme as the Google Workspace module. */
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

async function loadTokens(userId: string): Promise<SpTokens | null> {
  const { data, error } = await adminDb
    .from("manovik_user_integrations")
    .select("credentials")
    .eq("user_id", userId)
    .eq("provider", SP_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { credentials?: SpTokens } | null)?.credentials ?? null;
}

export async function saveSpotifyTokens(
  userId: string,
  tokens: { refresh_token: string; access_token: string; expires_in: number; scope?: string },
): Promise<void> {
  const creds: SpTokens = {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
  };
  const { error } = await adminDb.from("manovik_user_integrations").upsert(
    {
      user_id: userId,
      provider: SP_PROVIDER,
      credentials: creds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function unlinkSpotify(userId: string): Promise<void> {
  const { error } = await adminDb
    .from("manovik_user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", SP_PROVIDER);
  if (error) throw new Error(error.message);
}

export async function spotifyLinkStatus(
  userId: string,
): Promise<{ linked: boolean; linkedAt: string | null }> {
  const { data, error } = await adminDb
    .from("manovik_user_integrations")
    .select("linked_at")
    .eq("user_id", userId)
    .eq("provider", SP_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { linked: !!data, linkedAt: (data as { linked_at?: string } | null)?.linked_at ?? null };
}

function basicAuth(cfg: { clientId: string; clientSecret: string }): string {
  return Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<SpTokens> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(SP_NOT_CONFIGURED_MESSAGE);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(cfg)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    refresh_token?: string;
  };
  const updated: SpTokens = {
    refresh_token: body.refresh_token ?? refreshToken,
    access_token: body.access_token,
    expires_at: Date.now() + body.expires_in * 1000,
    scope: body.scope,
  };
  await adminDb
    .from("manovik_user_integrations")
    .update({ credentials: updated, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", SP_PROVIDER);
  return updated;
}

export function spAccessTokenExpired(tokens: SpTokens, now = Date.now()): boolean {
  if (!tokens.access_token || !tokens.expires_at) return true;
  return tokens.expires_at - now < 60_000;
}

export async function getSpAccessToken(userId: string): Promise<string> {
  let tokens = await loadTokens(userId);
  if (!tokens) throw new Error(SP_NOT_LINKED_MESSAGE);
  if (spAccessTokenExpired(tokens)) {
    tokens = await refreshAccessToken(userId, tokens.refresh_token);
  }
  if (!tokens.access_token) throw new Error("Spotify: could not obtain access token.");
  return tokens.access_token;
}

export async function exchangeSpCodeForTokens(
  code: string,
): Promise<{ refresh_token: string; access_token: string; expires_in: number; scope?: string }> {
  const cfg = oauthConfig();
  if (!cfg) throw new Error(SP_NOT_CONFIGURED_MESSAGE);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(cfg)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: spRedirectUri(),
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Spotify code exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    refresh_token?: string;
    access_token: string;
    expires_in: number;
    scope?: string;
  };
  if (!body.refresh_token) throw new Error("Spotify did not return a refresh token.");
  return {
    refresh_token: body.refresh_token,
    access_token: body.access_token,
    expires_in: body.expires_in,
    scope: body.scope,
  };
}

type SpFetchOptions = { method?: string; body?: unknown; query?: Record<string, string> };

/** Authorized Spotify Web API call with one transparent retry after refresh. */
export async function spFetch(
  userId: string,
  path: string,
  options: SpFetchOptions = {},
): Promise<Response> {
  const url = new URL(`${SPOTIFY_API}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);
  const doFetch = async (token: string) =>
    fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  let token = await getSpAccessToken(userId);
  let res = await doFetch(token);
  if (res.status === 401) {
    const tokens = await loadTokens(userId);
    if (!tokens) throw new Error(SP_NOT_LINKED_MESSAGE);
    const refreshed = await refreshAccessToken(userId, tokens.refresh_token);
    token = refreshed.access_token!;
    res = await doFetch(token);
  }
  return res;
}

export function spErrorMessage(status: number, text: string): string {
  if (status === 403 && /premium/i.test(text)) {
    return "Spotify needs a Premium account to start playback on a device. The account linked here isn't Premium.";
  }
  if (status === 404) {
    return "Spotify found no active device. Open Spotify on your phone, speaker or computer first, then ask again.";
  }
  return `Spotify API error (${status}): ${text.slice(0, 300)}`;
}

async function spJson<T>(userId: string, path: string, options: SpFetchOptions = {}): Promise<T> {
  const res = await spFetch(userId, path, options);
  if (res.status === 204) return undefined as T;
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(spErrorMessage(res.status, text));
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---- DJ data types ----

export interface SpTrack {
  uri: string;
  name: string;
  artists: string[];
  album: string;
  explicit: boolean;
  url: string;
  durationMs: number;
}

function toTrack(t: Record<string, unknown>): SpTrack {
  const artists = ((t.artists as Array<{ name?: string }> | undefined) ?? []).map(
    (a) => a.name ?? "",
  );
  return {
    uri: String(t.uri ?? ""),
    name: String(t.name ?? ""),
    artists,
    album: String((t.album as { name?: string } | undefined)?.name ?? ""),
    explicit: !!t.explicit,
    url: String((t.external_urls as { spotify?: string } | undefined)?.spotify ?? ""),
    durationMs: Number(t.duration_ms ?? 0),
  };
}

export interface SpDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

/** User's Spotify Connect devices. */
export async function spDevices(userId: string): Promise<SpDevice[]> {
  const res = await spJson<{ devices?: Array<Record<string, unknown>> }>(userId, "/me/player/devices");
  return (res.devices ?? []).map((d) => ({
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    type: String(d.type ?? ""),
    isActive: !!d.is_active,
  }));
}

/** Currently playing track + device. */
export async function spNowPlaying(userId: string): Promise<{
  track: SpTrack | null;
  device: string | null;
  isPlaying: boolean;
  progressMs: number;
}> {
  const res = await spJson<{
    item?: Record<string, unknown>;
    device?: { name?: string };
    is_playing?: boolean;
    progress_ms?: number;
  } | undefined>(userId, "/me/player/currently-playing");
  if (!res?.item) return { track: null, device: null, isPlaying: false, progressMs: 0 };
  return {
    track: toTrack(res.item),
    device: res.device?.name ?? null,
    isPlaying: !!res.is_playing,
    progressMs: res.progress_ms ?? 0,
  };
}

/** Search tracks/albums/artists/playlists. */
export async function spSearch(
  userId: string,
  query: string,
  types: Array<"track" | "album" | "artist" | "playlist"> = ["track"],
  limit = 10,
): Promise<{ tracks: SpTrack[]; playlists: Array<{ uri: string; name: string; url: string }> }> {
  const res = await spJson<{
    tracks?: { items?: Array<Record<string, unknown>> };
    playlists?: { items?: Array<Record<string, unknown> | null> };
  }>(userId, "/search", {
    query: {
      q: query,
      type: types.join(","),
      limit: String(Math.min(Math.max(limit, 1), 25)),
    },
  });
  return {
    tracks: (res.tracks?.items ?? []).map(toTrack),
    playlists: (res.playlists?.items ?? [])
      .filter((p): p is Record<string, unknown> => !!p)
      .map((p) => ({
        uri: String(p.uri ?? ""),
        name: String(p.name ?? ""),
        url: String((p.external_urls as { spotify?: string } | undefined)?.spotify ?? ""),
      })),
  };
}

/** Pure builder for the play request body — unit tested. */
export function buildPlayBody(args: {
  uris?: string[];
  contextUri?: string;
  offsetUri?: string;
}): Record<string, unknown> {
  if (args.uris?.length) {
    const body: Record<string, unknown> = { uris: args.uris };
    if (args.offsetUri) body.offset = { uri: args.offsetUri };
    return body;
  }
  if (args.contextUri) {
    const body: Record<string, unknown> = { context_uri: args.contextUri };
    if (args.offsetUri) body.offset = { uri: args.offsetUri };
    return body;
  }
  return {};
}

/** Start playback. deviceId optional — Spotify uses the active device. */
export async function spPlay(
  userId: string,
  args: { uris?: string[]; contextUri?: string; offsetUri?: string; deviceId?: string },
): Promise<void> {
  await spJson(userId, "/me/player/play", {
    method: "PUT",
    query: args.deviceId ? { device_id: args.deviceId } : {},
    body: buildPlayBody(args),
  });
  // FIX (agent-safety audit): autonomous playback is audit-logged.
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "spotify.play",
    summary: `Spotify playback started (${args.uris?.length ?? 0} tracks${args.contextUri ? ", context" : ""})`,
    metadata: { uris: args.uris?.slice(0, 5), contextUri: args.contextUri, deviceId: args.deviceId },
  });
}

export async function spPause(userId: string, deviceId?: string): Promise<void> {
  await spJson(userId, "/me/player/pause", {
    method: "PUT",
    query: deviceId ? { device_id: deviceId } : {},
  });
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({ userId, action: "spotify.pause", summary: "Spotify playback paused" });
}

export async function spResume(userId: string, deviceId?: string): Promise<void> {
  await spJson(userId, "/me/player/play", {
    method: "PUT",
    query: deviceId ? { device_id: deviceId } : {},
  });
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({ userId, action: "spotify.resume", summary: "Spotify playback resumed" });
}

export async function spSkip(userId: string, deviceId?: string): Promise<void> {
  await spJson(userId, "/me/player/next", {
    method: "POST",
    query: deviceId ? { device_id: deviceId } : {},
  });
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({ userId, action: "spotify.skip", summary: "Spotify skipped to next track" });
}

export async function spPrevious(userId: string, deviceId?: string): Promise<void> {
  await spJson(userId, "/me/player/previous", {
    method: "POST",
    query: deviceId ? { device_id: deviceId } : {},
  });
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({ userId, action: "spotify.previous", summary: "Spotify went to previous track" });
}

export async function spAddToQueue(userId: string, uri: string, deviceId?: string): Promise<void> {
  await spJson(userId, "/me/player/queue", {
    method: "POST",
    query: { uri, ...(deviceId ? { device_id: deviceId } : {}) },
  });
  const { logAgentAction } = await import("@/lib/agent-audit.server");
  await logAgentAction({
    userId,
    action: "spotify.queue_add",
    summary: "Spotify track added to queue",
    metadata: { uri },
  });
}

/** User's top tracks — the DJ's taste profile. */
export async function spTopTracks(userId: string, limit = 10): Promise<SpTrack[]> {
  const res = await spJson<{ items?: Array<Record<string, unknown>> }>(userId, "/me/top/tracks", {
    query: { limit: String(Math.min(Math.max(limit, 1), 25)), time_range: "medium_term" },
  });
  return (res.items ?? []).map(toTrack);
}

/** Create a playlist in the user's library; returns its uri + url. */
export async function spCreatePlaylist(
  userId: string,
  name: string,
  description?: string,
): Promise<{ uri: string; url: string }> {
  const me = await spJson<{ id?: string }>(userId, "/me");
  const pl = await spJson<Record<string, unknown>>(
    userId,
    `/users/${encodeURIComponent(me.id ?? "")}/playlists`,
    {
      method: "POST",
      body: { name, description: description ?? "", public: false },
    },
  );
  return {
    uri: String(pl.uri ?? ""),
    url: String((pl.external_urls as { spotify?: string } | undefined)?.spotify ?? ""),
  };
}

export async function spAddTracksToPlaylist(
  userId: string,
  playlistId: string,
  uris: string[],
): Promise<void> {
  await spJson(userId, `/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: "POST",
    body: { uris },
  });
}
