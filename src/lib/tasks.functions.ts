import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        instruction: z.string().trim().min(5).max(4000),
        conversationId: z.string().uuid().nullish(),
      })
      .parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("agent_tasks")
      .insert({
        user_id: userId,
        conversation_id: data.conversationId ?? null,
        title: data.title,
        instruction: data.instruction,
      })
      .select("id, title, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("id, title, status, result, error, conversation_id, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const runTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task, error } = await supabase
      .from("agent_tasks")
      .select("id, instruction, status")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !task) throw new Error("Task not found");
    if (task.status === "done" || task.status === "running") return { status: task.status };

    await supabase.from("agent_tasks").update({ status: "running" }).eq("id", task.id);

    try {
      const { runTaskAgent } = await import("./task-runner.server");
      const result = await runTaskAgent(task.instruction, (m) => console.log(`[task ${task.id}] ${m}`));
      await supabase.from("agent_tasks").update({ status: "done", result, error: null }).eq("id", task.id);
      return { status: "done" as const, result };
    } catch (e: any) {
      const message = String(e?.message || "Task failed").slice(0, 500);
      await supabase.from("agent_tasks").update({ status: "failed", error: message }).eq("id", task.id);
      return { status: "failed" as const, error: message };
    }
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("agent_tasks").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
