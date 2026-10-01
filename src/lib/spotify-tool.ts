// MANO chat tools: Spotify voice DJ.
//
// Exported in registry shape so the coordinator can register them in
// src/lib/agent-tools.ts. NOT registered here on purpose.
//
// DJ flow: spotify.search finds tracks ("<song> by <artist>" for exact
// matches), then spotify.play starts them on the active Connect device.
// Reads are free; playback actions need no extra confirmation beyond the
// user's request — but never play anything the user didn't ask for.
import { z } from "zod";
import type { ToolDef } from "./sandbox";
import {
  SP_NOT_LINKED_MESSAGE,
  buildPlayBody,
  spAddToQueue,
  spAddTracksToPlaylist,
  spCreatePlaylist,
  spDevices,
  spNowPlaying,
  spPause,
  spPlay,
  spPrevious,
  spResume,
  spSearch,
  spSkip,
  spTopTracks,
} from "./integrations/spotify.server";

function notLinked() {
  return { ok: false, error: "not_linked", message: SP_NOT_LINKED_MESSAGE };
}

function spotifyError(e: unknown) {
  const msg = e instanceof Error ? e.message : "unknown error";
  if (msg.includes("isn't linked")) return notLinked();
  return { ok: false, error: "spotify_error", message: msg.slice(0, 400) };
}

const searchTool: ToolDef<{ query: string; kinds?: Array<"track" | "album" | "artist" | "playlist">; limit?: number }> = {
  name: "spotify.search",
  description:
    "Search Spotify for music. For an exact song use \"<song> by <artist>\" so you don't pick a cover. Returns tracks (with uri, name, artists, album, [E] explicit flag, url) and playlists. Get uris here before playing or queueing.",
  schema: z.object({
    query: z.string().trim().min(1).max(200),
    kinds: z.array(z.enum(["track", "album", "artist", "playlist"])).max(4).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  timeoutMs: 30_000,
  maxOutputBytes: 12_000,
  rateLimitPerMin: 20,
  execute: async ({ query, kinds, limit }, { userId }) => {
    try {
      const res = await spSearch(userId, query, kinds ?? ["track"], limit ?? 10);
      return { ok: true, ...res };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const devicesTool: ToolDef<Record<string, never>> = {
  name: "spotify.devices",
  description:
    "List the user's Spotify Connect devices (phone, speaker, TV, computer). Use when the user names a device or nothing is playing.",
  schema: z.object({}),
  timeoutMs: 15_000,
  maxOutputBytes: 4_000,
  rateLimitPerMin: 20,
  execute: async (_args, { userId }) => {
    try {
      const devices = await spDevices(userId);
      return { ok: true, devices };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const nowPlayingTool: ToolDef<Record<string, never>> = {
  name: "spotify.now_playing",
  description: "What's currently playing on Spotify — track, device, play state, progress.",
  schema: z.object({}),
  timeoutMs: 15_000,
  maxOutputBytes: 4_000,
  rateLimitPerMin: 20,
  execute: async (_args, { userId }) => {
    try {
      const state = await spNowPlaying(userId);
      return { ok: true, ...state };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const playTool: ToolDef<{ uris?: string[]; contextUri?: string; deviceName?: string }> = {
  name: "spotify.play",
  description:
    "Start Spotify playback. Pass track uris from spotify.search (or a playlist/album contextUri). Plays on the user's active device unless deviceName matches one from spotify.devices. Needs Spotify Premium on the user's account — if it errors, say so plainly and don't retry.",
  schema: z.object({
    uris: z.array(z.string().startsWith("spotify:track:")).max(25).optional(),
    contextUri: z.string().startsWith("spotify:").max(200).optional(),
    deviceName: z.string().trim().max(100).optional(),
  }),
  timeoutMs: 30_000,
  maxOutputBytes: 4_000,
  rateLimitPerMin: 10,
  execute: async ({ uris, contextUri, deviceName }, { userId }) => {
    try {
      buildPlayBody({ uris, contextUri }); // validates shape before the network call
      let deviceId: string | undefined;
      if (deviceName) {
        const devices = await spDevices(userId);
        const match = devices.find((d) =>
          d.name.toLowerCase().includes(deviceName.toLowerCase()),
        );
        if (!match) {
          return {
            ok: false,
            error: "no_such_device",
            message: `No Spotify device matches "${deviceName}".`,
            devices,
          };
        }
        deviceId = match.id;
      }
      await spPlay(userId, { uris, contextUri, deviceId });
      return { ok: true, playing: uris ?? [contextUri] };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const pauseTool: ToolDef<Record<string, never>> = {
  name: "spotify.pause",
  description: "Pause Spotify playback.",
  schema: z.object({}),
  timeoutMs: 15_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async (_args, { userId }) => {
    try {
      await spPause(userId);
      return { ok: true, state: "paused" };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const resumeTool: ToolDef<Record<string, never>> = {
  name: "spotify.resume",
  description: "Resume paused Spotify playback.",
  schema: z.object({}),
  timeoutMs: 15_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async (_args, { userId }) => {
    try {
      await spResume(userId);
      return { ok: true, state: "playing" };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const skipTool: ToolDef<Record<string, never>> = {
  name: "spotify.skip",
  description: "Skip to the next track on Spotify.",
  schema: z.object({}),
  timeoutMs: 15_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async (_args, { userId }) => {
    try {
      await spSkip(userId);
      return { ok: true, state: "skipped" };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const previousTool: ToolDef<Record<string, never>> = {
  name: "spotify.previous",
  description: "Go back to the previous track on Spotify.",
  schema: z.object({}),
  timeoutMs: 15_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async (_args, { userId }) => {
    try {
      await spPrevious(userId);
      return { ok: true, state: "previous" };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const queueAddTool: ToolDef<{ uri: string }> = {
  name: "spotify.queue_add",
  description: "Add a track (spotify:track:… uri from spotify.search) to the Spotify queue — 'play this next' energy.",
  schema: z.object({ uri: z.string().startsWith("spotify:track:").max(200) }),
  timeoutMs: 15_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async ({ uri }, { userId }) => {
    try {
      await spAddToQueue(userId, uri);
      return { ok: true, queued: uri };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const tasteTool: ToolDef<{ limit?: number }> = {
  name: "spotify.taste",
  description:
    "The user's top tracks (medium term) — the DJ's read on their taste. Use to pick music they'll actually like when they say 'play something'.",
  schema: z.object({ limit: z.number().int().min(1).max(25).optional() }),
  timeoutMs: 30_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 10,
  execute: async ({ limit }, { userId }) => {
    try {
      const tracks = await spTopTracks(userId, limit ?? 10);
      return { ok: true, tracks };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

const makePlaylistTool: ToolDef<{ name: string; description?: string; queries: string[] }> = {
  name: "spotify.make_playlist",
  description:
    "Build a playlist for the user: give it a name and a list of song searches (\"<song> by <artist>\"). Creates a private playlist, searches each song, adds the top exact match. Confirm the name and vibe with the user first when it matters.",
  schema: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300).optional(),
    queries: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  }),
  timeoutMs: 60_000,
  maxOutputBytes: 6_000,
  rateLimitPerMin: 5,
  execute: async ({ name, description, queries }, { userId }) => {
    try {
      const playlist = await spCreatePlaylist(userId, name, description);
      const playlistId = playlist.uri.split(":").pop() ?? "";
      const added: string[] = [];
      const missed: string[] = [];
      for (const q of queries) {
        const res = await spSearch(userId, q, ["track"], 3);
        const hit = res.tracks[0];
        if (hit) {
          await spAddTracksToPlaylist(userId, playlistId, [hit.uri]);
          added.push(`${hit.name} — ${hit.artists.join(", ")}`);
        } else {
          missed.push(q);
        }
      }
      return { ok: true, playlist, added, missed };
    } catch (e) {
      return spotifyError(e);
    }
  },
};

export const spotifyTools = [
  searchTool,
  devicesTool,
  nowPlayingTool,
  playTool,
  pauseTool,
  resumeTool,
  skipTool,
  previousTool,
  queueAddTool,
  tasteTool,
  makePlaylistTool,
];
