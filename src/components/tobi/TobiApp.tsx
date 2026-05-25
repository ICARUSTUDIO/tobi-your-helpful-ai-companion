import { useEffect, useRef, useState } from "react";
import { Message } from "./Message";
import { MapOverlay } from "./MapOverlay";
import { ReaderDock } from "./ReaderDock";
import { DevConsole, type DevLog } from "./DevConsole";
import { parseDocument } from "./parseDoc";
import { TobiLogo } from "./TobiLogo";
import type { ChatMessage, Place, RedditPost } from "./types";

const SUGGESTIONS = [
  "Write a Python function that debounces async calls",
  "Find the best coffee shops in Lisbon",
  "Check Reddit for the best mechanical keyboard under $100",
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
  const [reader, setReader] = useState<{ post: RedditPost; summary: string } | null>(null);
  const [pendingDocs, setPendingDocs] = useState<{ name: string; kind: "docx" | "xlsx"; text: string; preview: string }[]>([]);
  const [devLogs, setDevLogs] = useState<DevLog[]>([]);
  const [devOpen, setDevOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<{ text: string; mode: "normal" | "research" } | null>(null);


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

  // Hidden dev console hotkey: Ctrl/Cmd + `
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setDevOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        const parsed = await parseDocument(f);
        setPendingDocs((p) => [...p, parsed]);
      } catch (e: any) {
        setMessages((m) => [...m, { id: uid(), role: "assistant", content: `⚠️ ${e?.message || "Could not read file."}` }]);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runChat(opts: {
    baseMessages: ChatMessage[];
    userMsg: ChatMessage;
    docs: { name: string; kind: "docx" | "xlsx"; text: string; preview: string }[];
    mode: "normal" | "research";
    originalInputText: string;
  }) {
    const { baseMessages, userMsg, docs, mode, originalInputText } = opts;
    const pendingId = uid();
    const pending: ChatMessage = { id: pendingId, role: "assistant", content: "", pending: true, mode };
    const nextMessages = [...baseMessages, userMsg];
    setMessages([...nextMessages, pending]);
    setBusy(true);
    setPendingPrompt({ text: userMsg.content, mode });

    const controller = new AbortController();
    abortRef.current = controller;

    const payloadMessages = nextMessages.map((m) => {
      if (m.id === userMsg.id && docs.length > 0) {
        const docBlocks = docs.map((d) => `\n\n--- Attached ${d.kind.toUpperCase()}: ${d.name} ---\n${d.text}\n--- end ${d.name} ---`).join("");
        return { role: m.role, content: m.content + docBlocks };
      }
      return { role: m.role, content: m.content };
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: payloadMessages }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (Array.isArray(data?.logs)) {
        setDevLogs((prev) => [...prev, { t: Date.now(), level: "info", tag: "client", msg: `── request "${userMsg.content.slice(0, 60)}" ──` }, ...data.logs]);
      }
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      const reply: ChatMessage = {
        id: pendingId, role: "assistant",
        content: data.text || "",
        places: data.places ?? null,
        post: data.post ?? null,
        mode,
      };
      setMessages([...nextMessages, reply]);
      if (data.places?.length > 0) setMapView({ places: data.places, summary: data.text || "" });
      if (data.post) setReader({ post: data.post, summary: data.text || "" });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setDevLogs((prev) => [...prev, { t: Date.now(), level: "warn", tag: "client", msg: "stopped by user" }]);
        setMessages(baseMessages);
        if (originalInputText) setInput(originalInputText);
        if (docs.length) setPendingDocs(docs);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        setDevLogs((prev) => [...prev, { t: Date.now(), level: "error", tag: "client", msg: e?.message || "request failed" }]);
        setMessages([...nextMessages, { id: pendingId, role: "assistant", content: `⚠️ ${e?.message || "Something went wrong."}` }]);
      }
    } finally {
      setBusy(false); setResearch(false); setPendingPrompt(null); abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && pendingDocs.length === 0) || busy) return;
    const userContent = text || "(see attached document)";
    const docs = pendingDocs;
    const originalInputText = input;
    const userMsg: ChatMessage = {
      id: uid(), role: "user", content: userContent,
      attachments: docs.map((d) => ({ name: d.name, kind: d.kind, preview: d.preview })),
    };
    setInput(""); setPendingDocs([]);
    await runChat({ baseMessages: messages, userMsg, docs, mode: research ? "research" : "normal", originalInputText });
  }

  function stop() {
    abortRef.current?.abort();
  }

  function retry(messageId: string, mode: "normal" | "research") {
    if (busy) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const original = messages[idx];
    if (original.role !== "user") return;
    const baseMessages = messages.slice(0, idx);
    const userMsg: ChatMessage = { ...original, id: uid() };
    runChat({ baseMessages, userMsg, docs: [], mode, originalInputText: "" });
  }

  function editMessage(messageId: string) {
    if (busy) return;
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const original = messages[idx];
    if (original.role !== "user") return;
    setMessages(messages.slice(0, idx));
    setInput(original.content);
    setTimeout(() => {
      const el = inputRef.current;
      el?.focus();
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground flex flex-col">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, var(--tobi-glow), transparent 60%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, oklch(0.55 0.22 270), transparent 60%)" }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <TobiLogo className="size-9 rounded-xl" markClassName="size-7" />
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">Tobi</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">your interactive AI</div>
          </div>
        </div>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1.5 text-xs hover:bg-card transition" aria-label="Toggle theme">
          {theme === "dark" ? "☾ Dark" : "☀ Light"}
        </button>
      </header>

      <main ref={scrollRef} className="relative z-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="pt-12 text-center space-y-6">
              <TobiLogo className="mx-auto size-20 rounded-3xl" markClassName="size-14" />
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">Hey, I'm Tobi.</h1>
                <p className="mt-2 text-muted-foreground text-sm max-w-md mx-auto">
                  I write code, hunt bugs, dive deep into research, find places on a map, pull Reddit threads (with a Listen button), and read your Word / Excel docs.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto pt-4">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="text-left rounded-xl border border-border bg-card/60 backdrop-blur px-4 py-3 text-sm hover:border-tobi/50 hover:bg-card transition">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const isLastUser = m.role === "user" && i === messages.length - 1 && !busy;
              const isPriorUser = m.role === "user" && i < messages.length - 1 && messages[i + 1]?.role === "assistant" && !messages[i + 1]?.pending;
              const canAct = (isLastUser || isPriorUser) && !busy;
              return (
                <Message
                  key={m.id}
                  m={m}
                  pendingPromptText={m.pending ? pendingPrompt?.text : undefined}
                  pendingPromptMode={m.pending ? pendingPrompt?.mode : undefined}
                  onShowMap={m.places ? () => setMapView({ places: m.places!, summary: m.content }) : undefined}
                  onShowReader={m.post ? () => setReader({ post: m.post!, summary: m.content }) : undefined}
                  onRetry={canAct ? () => retry(m.id, m.mode === "research" ? "research" : "normal") : undefined}
                  onEdit={canAct ? () => editMessage(m.id) : undefined}
                  onDeepDive={canAct ? () => retry(m.id, "research") : undefined}
                />
              );
            })
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-4">
          {pendingDocs.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pendingDocs.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-tobi/15 border border-tobi/40 px-2.5 py-1 text-[11px] text-tobi">
                  📎 {d.name}
                  <button onClick={() => setPendingDocs((p) => p.filter((_, j) => j !== i))} className="hover:text-foreground">×</button>
                </span>
              ))}
            </div>
          )}
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
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".docx,.xlsx,.xls,.csv" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  title="Attach Word or Excel"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground/80 hover:border-tobi/50 hover:text-tobi transition"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.99 8.8l-8.57 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Attach
                </button>
                <button
                  onClick={() => setResearch((v) => !v)}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${research ? "bg-tobi text-primary-foreground border-tobi" : "bg-transparent text-foreground/80 border-border hover:border-tobi/50 hover:text-tobi"}`}
                  title="Toggle deep research mode"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                  Research
                </button>
              </div>
              <button
                onClick={send}
                disabled={busy || (!input.trim() && pendingDocs.length === 0)}
                className="inline-flex items-center gap-1.5 rounded-full bg-tobi text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {busy ? "Thinking…" : "Send"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground text-center mt-2">
            Tobi can make mistakes. Verify important info.
          </div>
        </div>
      </footer>

      {mapView && (
        <MapOverlay places={mapView.places} summary={mapView.summary} onClose={() => setMapView(null)} />
      )}
      {reader && (
        <ReaderDock post={reader.post} summary={reader.summary} onClose={() => setReader(null)} />
      )}
      <DevConsole logs={devLogs} open={devOpen} onClose={() => setDevOpen(false)} onClear={() => setDevLogs([])} />

    </div>
  );
}
