import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listTasks, deleteTask } from "@/lib/tasks.functions";

interface Task {
  id: string;
  title: string;
  status: string;
  result: string | null;
  error: string | null;
  created_at: string;
}

export function TasksDrawer({ open, onClose, refreshKey }: { open: boolean; onClose: () => void; refreshKey: number }) {
  const fetchTasks = useServerFn(listTasks);
  const removeTask = useServerFn(deleteTask);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchTasks()
      .then((t) => setTasks(t as unknown as Task[]))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [open, refreshKey, fetchTasks]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-card flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <div className="font-semibold text-sm">Background tasks</div>
            <div className="text-[11px] text-muted-foreground">Jobs Tobi ran on his own</div>
          </div>
          <button onClick={onClose} aria-label="Close tasks" className="size-8 grid place-items-center rounded-lg hover:bg-muted">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && <div className="text-xs text-muted-foreground px-1">Loading…</div>}
          {!loading && tasks.length === 0 && (
            <div className="text-xs text-muted-foreground px-1">No tasks yet. Ask Tobi for something big and he'll offer to run it in the background.</div>
          )}
          {tasks.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left flex-1" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.status === "running" && "⏳ Working on it…"}
                    {t.status === "queued" && "• Queued"}
                    {t.status === "done" && "✅ Done, tap to read"}
                    {t.status === "failed" && `⚠️ ${t.error ?? "Failed"}`}
                  </div>
                </button>
                <button
                  onClick={async () => {
                    await removeTask({ data: { id: t.id } }).catch(() => {});
                    setTasks((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                  aria-label={`Delete task ${t.title}`}
                  className="text-muted-foreground hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
              {expanded === t.id && t.result && (
                <div className="mt-2 pt-2 border-t border-border prose prose-invert prose-sm max-w-none text-[13px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.result}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
