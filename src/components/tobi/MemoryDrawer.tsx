import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listFacts, deleteFact } from "@/lib/conversations.functions";

interface Fact { id: string; fact: string; created_at: string }

interface Props {
  open: boolean;
  onClose: () => void;
  name: string | null;
  onChange?: (facts: string[]) => void;
}

export function MemoryDrawer({ open, onClose, name, onChange }: Props) {
  const list = useServerFn(listFacts);
  const del = useServerFn(deleteFact);
  const [items, setItems] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    list().then((r) => {
      const rows = r as Fact[];
      setItems(rows);
      onChange?.(rows.map((x) => x.fact));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open, list, onChange]);

  async function remove(id: string) {
    if (!confirm("Forget this?")) return;
    await del({ data: { id } });
    const next = items.filter((c) => c.id !== id);
    setItems(next);
    onChange?.(next.map((x) => x.fact));
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 w-[min(380px,90vw)] z-50 bg-card border-l border-border flex flex-col animate-in slide-in-from-right">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-base font-semibold tracking-tight">What Tobi knows</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {name ? `about ${name}` : "about you"} — tap × to forget anything.
              </div>
            </div>
            <button onClick={onClose} className="size-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
          {loading ? (
            <div className="text-xs text-muted-foreground px-2 py-4">Loading memory…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-6 text-center">
              Tobi hasn't picked up any facts yet. Tell him about yourself — where you live, what you do, what you love — and they'll show up here.
            </div>
          ) : (
            items.map((f) => (
              <div
                key={f.id}
                className="group rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm flex items-start justify-between gap-2 hover:border-tobi/40 transition"
              >
                <div className="flex-1 leading-snug">{f.fact}</div>
                <button
                  onClick={() => remove(f.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 text-base leading-none px-1"
                  title="Forget"
                >×</button>
              </div>
            ))
          )}
        </div>
        <div className="px-5 py-3 border-t border-border text-[10px] text-muted-foreground">
          Tobi learns from your messages and keeps these notes so he can talk like a friend who remembers.
        </div>
      </aside>
    </>
  );
}
