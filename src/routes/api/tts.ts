import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  text: z.string().min(1).max(4500),
  voice_id: z.string().min(1).max(80).default("aura-2-asteria-en"),
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
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "no_key" }), { status: 503, headers: { "Content-Type": "application/json" } });
        }
        const { text, voice_id } = parsed.data;
        const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice_id)}&encoding=mp3`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("[tts] deepgram failed", res.status, err.slice(0, 200));
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
