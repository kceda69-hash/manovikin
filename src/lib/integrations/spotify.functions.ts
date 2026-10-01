import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { spotifyLinkStatus, unlinkSpotify } from "./spotify.server";

type Ctx = { userId: string };

export const getSpotifyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as Ctx;
    try {
      return await spotifyLinkStatus(userId);
    } catch {
      return { linked: false, linkedAt: null };
    }
  });

export const unlinkSpotifyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as Ctx;
    await unlinkSpotify(userId);
    return { ok: true };
  });
