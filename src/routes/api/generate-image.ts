import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * MANOVIK image studio — streaming, ultra-detail image generation.
 * Authenticated (same bearer token as /api/chat). Non-admins spend credits.
 */
const QUALITY_SUFFIX: Record<string, string> = {
  "8k": "Ultra-detailed 8K master render, photoreal micro-detail, physically accurate lighting, razor-sharp focus, no artifacts, no text unless requested.",
  "4k": "Crisp 4K render, high dynamic range, clean edges, accurate materials and lighting.",
  standard: "High quality, clean composition, accurate to the prompt.",
};

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const sovereignBaseUrl = process.env.MANOVIK_AI_BASE_URL;
        const sovereignKey = process.env.MANOVIK_AI_API_KEY;
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!sovereignBaseUrl && !apiKey)
          return new Response(
            "Missing LOVABLE_API_KEY (or set MANOVIK_AI_BASE_URL for sovereign mode)",
            { status: 500 },
          );

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer "))
          return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7);

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub as string | undefined;
        if (claimsErr || !userId) return new Response("Unauthorized", { status: 401 });

        let body: { prompt?: string; quality?: string; aspect?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim().slice(0, 4000);
        if (!prompt) return new Response("Prompt is required", { status: 400 });
        const quality = body.quality === "8k" || body.quality === "4k" ? body.quality : "standard";
        const aspect = typeof body.aspect === "string" ? body.aspect.slice(0, 12) : "1:1";

        const { data: isAdminData } = await (
          supabaseAdmin.rpc as never as (
            f: string,
            a: Record<string, unknown>,
          ) => Promise<{ data: boolean | null }>
        )("has_role", { _user_id: userId, _role: "admin" });
        if (!isAdminData) {
          const { data: spend, error: spendErr } = await (
            supabaseAdmin.rpc as never as (
              f: string,
              a: Record<string, unknown>,
            ) => Promise<{ data: number | null; error: { message: string } | null }>
          )("manovik_spend_credit", { _user_id: userId, _amount: 2, _reason: "image.generate" });
          if (spendErr) return new Response("Credit service unavailable", { status: 500 });
          if (typeof spend === "number" && spend < 0) {
            return new Response(
              JSON.stringify({
                error: "insufficient_manovik_credits",
                message: "Your Manovik AI balance is empty. Top up to generate images.",
              }),
              { status: 402, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        const enriched = `${prompt}\n\nRendering brief: ${QUALITY_SUFFIX[quality]} Aspect ratio ${aspect}. Follow the prompt exactly — every named object, colour, count and placement must appear.`;

        // Sovereign: any OpenAI-compatible /images/generations endpoint
        // (e.g. OpenAI gpt-image-1 via MANOVIK_AI_IMAGE_MODEL). Ollama cannot
        // generate images, so point MANOVIK_AI_BASE_URL at a capable provider
        // for this route, or keep the Lovable gateway.
        const imageUrl = sovereignBaseUrl
          ? `${sovereignBaseUrl.replace(/\/$/, "")}/images/generations`
          : "https://ai.gateway.lovable.dev/v1/images/generations";
        const imageModel = sovereignBaseUrl
          ? (process.env.MANOVIK_AI_IMAGE_MODEL ?? "gpt-image-1")
          : "google/gemini-3-pro-image";
        const upstream = await fetch(imageUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sovereignBaseUrl ? (sovereignKey ?? "manovik") : apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: imageModel,
            messages: [{ role: "user", content: enriched }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
