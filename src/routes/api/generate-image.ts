import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiKeys, clearKeyThrottled, markKeyThrottled, pickKeyIndex } from "@/lib/ai-key-failover";

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

        // Refund the 2 credits when generation fails after charging.
        const refundImageCredit = () => {
          supabaseAdmin
            .rpc("manovik_topup_credit", {
              _user_id: userId,
              _amount: 2,
              _reason: "image.refund:api_error",
            })
            .then(({ error }) => {
              if (error) console.error("image refund failed", error.message);
            });
        };

        if (!sovereignBaseUrl) {
          // Legacy Lovable gateway path (self-hosted / non-sovereign mode).
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-pro-image",
              messages: [{ role: "user", content: enriched }],
              modalities: ["image", "text"],
              stream: true,
            }),
          });
          if (!upstream.ok || !upstream.body) {
            refundImageCredit();
            return new Response(await upstream.text(), { status: upstream.status });
          }
          return new Response(upstream.body, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }

        // Sovereign: Gemini native generateContent with image output.
        // Google's OpenAI-compatible layer does not serve image models, so the
        // old /images/generations call (with an OpenAI model name) could never
        // work — call the native endpoint directly instead. Transparent
        // failover: on a 429 the same request is retried on the backup key
        // (no stream has started yet, unlike chat).
        const nativeRoot = sovereignBaseUrl.replace(/\/openai\/?$/, "").replace(/\/$/, "");
        const imageModel =
          process.env.MANOVIK_AI_IMAGE_MODEL ?? "gemini-2.0-flash-preview-image-generation";
        const url = `${nativeRoot}/models/${imageModel}:generateContent`;

        interface GeminiPart {
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
        }
        interface GeminiResponse {
          candidates?: { content?: { parts?: GeminiPart[] } }[];
          promptFeedback?: { blockReason?: string };
          error?: { message?: string };
        }

        const keys = aiKeys();
        const preferred = pickKeyIndex();
        const tryOrder = [preferred, ...keys.map((_, i) => i).filter((i) => i !== preferred)];
        let b64: string | null = null;
        let lastErr = "no API key configured";
        for (const ki of tryOrder) {
          const key = keys[ki];
          if (!key) continue;
          let res: Response;
          try {
            res = await fetch(url, {
              method: "POST",
              headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: enriched }] }],
                generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
              }),
            });
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "network error";
            break;
          }
          if (res.status === 429 && ki !== tryOrder[tryOrder.length - 1]) {
            markKeyThrottled(ki);
            lastErr = "rate limited, retrying with backup key";
            continue;
          }
          if (!res.ok) {
            lastErr = `image API ${res.status}: ${(await res.text()).slice(0, 200)}`;
            break;
          }
          const data = (await res.json()) as GeminiResponse;
          if (data.error?.message) {
            lastErr = data.error.message.slice(0, 200);
            break;
          }
          if (data.promptFeedback?.blockReason) {
            lastErr = `Image blocked by safety filter (${data.promptFeedback.blockReason}). Try a different prompt.`;
            break;
          }
          const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
          if (!part?.inlineData?.data) {
            lastErr = "The image model returned no image. Try again.";
            break;
          }
          b64 = part.inlineData.data;
          clearKeyThrottled(ki);
          break;
        }

        if (!b64) {
          refundImageCredit();
          return new Response(`Image generation failed: ${lastErr}`, { status: 502 });
        }

        // Emit OpenAI-style SSE frames so the existing client works unchanged.
        const encoder = new TextEncoder();
        const frames = [
          `event: image_generation.partial_image\ndata: ${JSON.stringify({
            type: "image_generation.partial_image",
            b64_json: b64,
            partial_image_index: 0,
          })}\n\n`,
          `event: image_generation.completed\ndata: ${JSON.stringify({
            type: "image_generation.completed",
            b64_json: b64,
          })}\n\n`,
        ];
        const stream = new ReadableStream({
          start(controller) {
            for (const f of frames) controller.enqueue(encoder.encode(f));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
