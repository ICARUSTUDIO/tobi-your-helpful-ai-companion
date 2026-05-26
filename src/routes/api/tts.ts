import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  text: z.string().min(1).max(4500),
  voice_id: z.string().min(1).max(80).default("9BWtsMINqrJLrRacOk9x"), // Aria - warm, natural
});

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = await request.json().catch(() => null);
        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "no_key" }), { status: 503, headers: { "Content-Type": "application/json" } });
        }
        const { text, voice_id } = parsed.data;
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id)}?output_format=mp3_44100_128`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.35,
              use_speaker_boost: true,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("[tts] elevenlabs failed", res.status, err.slice(0, 200));
          return new Response(JSON.stringify({ error: "tts_failed", status: res.status }), { status: res.status, headers: { "Content-Type": "application/json" } });
        }
        return new Response(res.body, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
