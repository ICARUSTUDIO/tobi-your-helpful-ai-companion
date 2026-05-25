import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listConversations, deleteConversation } from "@/lib/conversations.functions";

interface Convo { id: string; title: string; updated_at: string; created_at: string }

interface Props {
  open: boolean;
  onClose: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
}

export function HistorySidebar({ open, onClose, activeId, onSelect, onNew, refreshKey }: Props) {
  const list = useServerFn(listConversations);
  const del = useServerFn(deleteConversation);
  const [items, setItems] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    list().then((r) => { setItems(r as Convo[]); setLoading(false); }).catch(() => setLoading(false));
  }, [open, refreshKey, list]);

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    await del({ data: { id } });
    setItems((p) => p.filter((c) => c.id !== id));
    if (activeId === id) onNew();
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed top-0 left-0 bottom-0 w-[min(320px,85vw)] z-50 bg-card border-r border-border flex flex-col animate-in slide-in-from-left">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-display text-sm font-semibold">Your chats</div>
          <button onClick={onClose} className="size-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground">×</button>
        </div>
        <button onClick={() => { onNew(); onClose(); }} className="mx-3 mt-3 rounded-full bg-tobi text-primary-foreground py-2 text-xs font-semibold hover:opacity-90">+ New chat</button>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
          {loading ? (
            <div className="text-xs text-muted-foreground px-3 py-4">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground px-3 py-4">No chats yet. Say hi to Tobi.</div>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); onClose(); }}
                className={`group w-full text-left rounded-xl px-3 py-2 text-xs transition flex items-center justify-between gap-2 ${activeId === c.id ? "bg-tobi/15 text-foreground" : "hover:bg-muted text-foreground/85"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</div>
                </div>
                <span onClick={(e) => remove(c.id, e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 px-1">×</span>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
