import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function summarize(messages: { role: string; content: string }[]): Promise<string> {
  const key = process.env.AI_API_KEY;
  if (!key) return "";
  const transcript = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")
    .slice(0, 12000);
  const res = await fetch(process.env.AI_GATEWAY_URL ?? "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You distill a chat transcript into ONE concise, generalizable fact, tip, or piece of knowledge that would help an AI assistant named Tobi answer similar questions in the future. " +
            "Output a SINGLE sentence under 280 characters. No preamble. No personal info, names, or identifiers. " +
            "If the chat contains nothing reusable, output exactly: SKIP",
        },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) return "";
  const json: any = await res.json();
  const out = (json?.choices?.[0]?.message?.content ?? "").trim();
  if (!out || out === "SKIP") return "";
  return out.slice(0, 500);
}

export const submitTrainingData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      conversationId: z.string().uuid().nullable(),
      messages: z
        .array(z.object({ role: z.string(), content: z.string() }))
        .min(2)
        .max(60),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const summary = await summarize(data.messages);
    const { error } = await supabase.from("training_submissions").insert({
      user_id: userId,
      conversation_id: data.conversationId,
      raw_messages: data.messages,
      ai_summary: summary || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, hasSummary: !!summary };
  });

export const listPendingSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("training_submissions")
      .select("id, user_id, conversation_id, raw_messages, ai_summary, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listGlobalKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("global_knowledge")
      .select("id, fact, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      fact: z.string().trim().min(3).max(500).optional(),
      note: z.string().max(500).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const { error: upErr } = await supabase
      .from("training_submissions")
      .update({
        status: data.decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        reviewer_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    if (data.decision === "approved" && data.fact) {
      const { error: insErr } = await supabase.from("global_knowledge").insert({
        fact: data.fact,
        source_submission_id: data.id,
        created_by: userId,
      });
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    const { error } = await supabase.from("global_knowledge").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
    return { isAdmin: !!(data && data.length > 0) };
  });
