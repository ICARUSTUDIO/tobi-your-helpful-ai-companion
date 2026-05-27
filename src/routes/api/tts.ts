import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().min(1).max(40).default("sage"),
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
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "no_key" }), { status: 503, headers: { "Content-Type": "application/json" } });
        }
        const { text, voice } = parsed.data;
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            voice,
            input: text,
            instructions: "Speak in a warm, friendly, conversational tone — like a smart friend casually explaining something interesting. Natural pacing, not robotic.",
            response_format: "mp3",
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("[tts] openai failed", res.status, err.slice(0, 300));
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
