import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXTRACT_PROMPT = `Extract any durable, personal facts the user revealed about THEMSELVES in this message. Examples: where they live, job, hobbies, preferences, family, what they own, what they're working on, what they like/hate.

Rules:
- Only facts about the USER, not about others or the world.
- Write each fact as a short third-person sentence ("Lives in Lagos", "Works as a backend engineer", "Owns a Husky named Bruno", "Prefers dark mode", "Is learning Rust").
- Skip greetings, questions, transient feelings, generic statements.
- If there are no durable facts, return an empty array.
- Max 5 facts.

Return ONLY valid JSON: { "facts": ["...", "..."] }`;

export const extractAndSaveFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ message: z.string().min(1).max(5000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { facts: [] };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: EXTRACT_PROMPT },
            { role: "user", content: data.message },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) return { facts: [] };
      const json = await res.json() as any;
      const content = json?.choices?.[0]?.message?.content || "{}";
      let parsed: { facts?: string[] } = {};
      try { parsed = JSON.parse(content); } catch { return { facts: [] }; }
      const facts = (parsed.facts || []).map((f) => String(f).trim()).filter((f) => f.length > 3 && f.length < 200).slice(0, 5);
      if (facts.length === 0) return { facts: [] };

      // Dedupe against existing
      const { data: existing } = await supabase.from("user_facts").select("fact").eq("user_id", userId);
      const existingSet = new Set((existing ?? []).map((r: any) => r.fact.toLowerCase()));
      const fresh = facts.filter((f) => !existingSet.has(f.toLowerCase()));
      if (fresh.length === 0) return { facts: [] };

      await supabase.from("user_facts").insert(fresh.map((fact) => ({ user_id: userId, fact })));

      // Memory cap: keep only the 100 most recent facts per user (FIFO eviction)
      const MAX_FACTS_PER_USER = 100;
      const { data: all } = await supabase
        .from("user_facts")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (all && all.length > MAX_FACTS_PER_USER) {
        const toDelete = all.slice(MAX_FACTS_PER_USER).map((r: any) => r.id);
        if (toDelete.length > 0) {
          await supabase.from("user_facts").delete().in("id", toDelete);
        }
      }

      return { facts: fresh };
    } catch {
      return { facts: [] };
    }
  });
