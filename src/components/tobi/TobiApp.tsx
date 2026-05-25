import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";
import { MapOverlay } from "./MapOverlay";
import type { ChatMessage, Place } from "./types";

const SUGGESTIONS = [
  "Write a Python function that debounces async calls",
  "Find the best coffee shops in Lisbon",
  "Explain CRDTs like I'm a senior engineer",
  "Debug: TypeError: Cannot read properties of undefined",
];

function uid() { return Math.random().toString(36).slice(2); }

export function TobiApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [research, setResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mapView, setMapView] = useState<{ places: Place[]; summary: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("tobi-theme")) as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("tobi-theme", theme);
  }, [theme]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const pendingId = uid();
    const pending: ChatMessage = { id: pendingId, role: "assistant", content: "", pending: true, mode: research ? "research" : "normal" };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, pending]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: research ? "research" : "normal",
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      const reply: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: data.text || "",
        places: data.places ?? null,
        mode: research ? "research" : "normal",
      };
      setMessages([...nextMessages, reply]);
      if (data.places && data.places.length > 0) {
        setMapView({ places: data.places, summary: data.text || "" });
      }
    } catch (e: any) {
      setMessages([
        ...nextMessages,
        { id: pendingId, role: "assistant", content: `⚠️ ${e?.message || "Something went wrong."}` },
      ]);
    } finally {
      setBusy(false);
      setResearch(false);
      inputRef.current?.focus();
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground flex flex-col">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, var(--tobi-glow), transparent 60%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, oklch(0.55 0.22 270), transparent 60%)" }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl tobi-orb grid place-items-center text-sm font-bold text-background">T</div>
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">Tobi</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">your interactive AI</div>
          </div>
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1.5 text-xs hover:bg-card transition"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
      </header>

      {/* Chat scroll */}
      <main ref={scrollRef} className="relative z-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="pt-12 text-center space-y-6">
              <div className="mx-auto size-20 rounded-3xl tobi-orb grid place-items-center text-3xl font-bold text-background">T</div>
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">Hey, I'm Tobi.</h1>
                <p className="mt-2 text-muted-foreground text-sm max-w-md mx-auto">
                  I write code, hunt bugs, dive deep into research, and find real places on a map. Ask me anything.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto pt-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left rounded-xl border border-border bg-card/60 backdrop-blur px-4 py-3 text-sm hover:border-tobi/50 hover:bg-card transition"
                  >{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <Message
                key={m.id}
                m={m}
                onShowMap={m.places ? () => setMapView({ places: m.places!, summary: m.content }) : undefined}
              />
            ))
          )}
        </div>
      </main>

      {/* Input bar — always visible */}
      <footer className="relative z-10 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className={`rounded-2xl border bg-card/80 backdrop-blur p-2 transition ${research ? "border-tobi/60 glow-ring" : "border-border"}`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={research ? "Ask Tobi for a deep dive…" : "Ask Tobi anything…"}
              rows={1}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-40"
              style={{ minHeight: "2.25rem" }}
            />
            <div className="flex items-center justify-between gap-2 px-2 pt-1">
              <button
                onClick={() => setResearch((v) => !v)}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                  research
                    ? "bg-tobi text-primary-foreground border-tobi"
                    : "bg-transparent text-foreground/80 border-border hover:border-tobi/50 hover:text-tobi"
                }`}
                title="Toggle deep research mode"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                Research
              </button>
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-tobi text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {busy ? "Thinking…" : "Send"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground text-center mt-2">
            Tobi can make mistakes. Verify important info.
          </div>
        </div>
      </footer>

      {mapView && (
        <MapOverlay
          places={mapView.places}
          summary={mapView.summary}
          onClose={() => setMapView(null)}
        />
      )}
    </div>
  );
}
