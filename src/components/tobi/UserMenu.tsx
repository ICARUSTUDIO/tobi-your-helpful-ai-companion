import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  name: string | null;
  email: string | null;
  onOpenHistory: () => void;
  onOpenMemory: () => void;
  onNewChat: () => void;
}

export function UserMenu({ name, email, onOpenHistory, onOpenMemory, onNewChat }: Props) {
  const [open, setOpen] = useState(false);
  const initial = (name || email || "?").charAt(0).toUpperCase();
  const isCreator = (email ?? "").toLowerCase() === "tobyfemi55@gmail.com";

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="size-9 rounded-full bg-tobi/20 border border-tobi/40 text-tobi font-semibold text-sm hover:bg-tobi/30 transition">
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-60 rounded-2xl border border-border bg-card shadow-2xl py-1 text-sm">
            <div className="px-3 py-2 border-b border-border">
              <div className="font-medium truncate">{name || "Hey there"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{email}</div>
            </div>
            <button onClick={() => { onNewChat(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-muted">+ New chat</button>
            <button onClick={() => { onOpenHistory(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-muted">Chat history</button>
            <button onClick={() => { onOpenMemory(); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between">
              <span>What Tobi knows</span>
              <span className="text-[10px] text-muted-foreground">memory</span>
            </button>
            {isCreator && (
              <Link to="/admin/training" onClick={() => setOpen(false)} className="block w-full text-left px-3 py-2 hover:bg-muted text-tobi">
                👑 Training review
              </Link>
            )}
            <div className="h-px bg-border my-1" />
            <button onClick={() => supabase.auth.signOut()} className="w-full text-left px-3 py-2 hover:bg-muted text-red-400">Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
