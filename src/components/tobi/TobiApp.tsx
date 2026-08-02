import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Message } from "./Message";
const MapOverlay = lazy(() => import("./MapOverlay").then((m) => ({ default: m.MapOverlay })));
import { ReaderDock } from "./ReaderDock";
import { DevConsole, type DevLog } from "./DevConsole";
import { parseDocument } from "./parseDoc";
import { TobiLogo } from "./TobiLogo";
import { OnboardingModal } from "./OnboardingModal";
import { HistorySidebar } from "./HistorySidebar";
import { UserMenu } from "./UserMenu";
import { MemoryDrawer } from "./MemoryDrawer";
import { TasksDrawer } from "./TasksDrawer";
import { AgentSteps } from "./AgentSteps";
import { ApprovalCard } from "./ApprovalCard";
import type { AgentStep, ChatMessage, Place, RedditPost } from "./types";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import {
  createConversation,
  saveMessage,
  loadConversation,
  listFacts,
  listConversations,
  renameConversation,
} from "@/lib/conversations.functions";
import { extractAndSaveFacts, saveFact } from "@/lib/facts.functions";
import { createTask, runTask } from "@/lib/tasks.functions";
import { submitTrainingData } from "@/lib/training.functions";
import { TrainTobiModal } from "./TrainTobiModal";

const SUGGESTION_POOL: string[] = [
  // Code
  "Write a Python function that debounces async calls",
  "Explain async/await like I'm five",
  "Refactor this React component to use hooks",
  "Write a SQL query to find duplicate rows",
  "Generate a TypeScript type from this JSON",
  "Set up a Vite + React + Tailwind starter",
  // Debug
  "Debug: TypeError: Cannot read properties of undefined",
  "Why is my useEffect running twice?",
  "Help me read this stack trace",
  "My Docker container exits immediately — why?",
  // Research
  "Compare Postgres vs MongoDB for a social app",
  "Summarize the latest on AI regulation",
  "What's new in React 19?",
  "Pros and cons of monorepos in 2026",
  "Explain CRDTs in plain English",
  // Places / map
  "Find the best coffee shops in Lisbon",
  "Plan a 3-day trip to Tokyo",
  "Quiet spots to work from in Berlin",
  "Best ramen near Shibuya",
  "Hidden-gem bookstores in NYC",
  // Reddit / threads
  "Check Reddit for the best mechanical keyboard under $100",
  "What does r/personalfinance say about index funds?",
  "Best budget noise-cancelling headphones — Reddit consensus",
  // Life / fun
  "Give me a 20-minute home workout",
  "Suggest a weekend project I can finish in a day",
  "Recommend a sci-fi book like Project Hail Mary",
  "Help me write a polite 'no' to a meeting",
  "Plan dinner for 4 with what's usually in my fridge",
];

// Deterministic daily shuffle so suggestions feel fresh but stay stable through the day
function dayHash(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickDailySuggestions(pool: string[], count: number, salt = 0): string[] {
  const rand = mulberry32(dayHash() + salt);
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}


function uid() { return Math.random().toString(36).slice(2); }

export function TobiApp() {
  const { user, loading: authLoading } = useAuth();

  // Server fns
  const fetchProfile = useServerFn(getMyProfile);

  const saveProfile = useServerFn(updateMyProfile);
  const newConvo = useServerFn(createConversation);
  const saveMsg = useServerFn(saveMessage);
  const loadConvo = useServerFn(loadConversation);
  const fetchFacts = useServerFn(listFacts);
  const renameConvo = useServerFn(renameConversation);
  const fetchConvos = useServerFn(listConversations);
  const extractFacts = useServerFn(extractAndSaveFacts);
  const storeFact = useServerFn(saveFact);
  const newTask = useServerFn(createTask);
  const startTask = useServerFn(runTask);
  const submitTraining = useServerFn(submitTrainingData);
  const [trainPrompt, setTrainPrompt] = useState<null | { convoId: string | null; messages: ChatMessage[] }>(null);
  const [recentConvos, setRecentConvos] = useState<{ id: string; title: string }[]>([]);


  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [facts, setFacts] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasksKey, setTasksKey] = useState(0);
  const [historyKey, setHistoryKey] = useState(0);

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
  const lastRunRef = useRef<null | {
    baseMessages: ChatMessage[];
    userMsg: ChatMessage;
    docs: { name: string; kind: "docx" | "xlsx"; text: string; preview: string }[];
    mode: "normal" | "research";
    approvals: string[];
  }>(null);

  // Load profile + facts + recent convos when signed in
  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);
    Promise.all([fetchProfile(), fetchFacts().catch(() => []), fetchConvos().catch(() => [])]).then(([p, f, c]) => {
      setProfile(p);
      setFacts((f as any[]).map((x) => x.fact));
      setRecentConvos((c as any[]).slice(0, 5).map((x) => ({ id: x.id, title: x.title })));
      setProfileLoading(false);
    }).catch(() => setProfileLoading(false));
  }, [user, fetchProfile, fetchFacts, fetchConvos]);


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

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const c = await newConvo();
    setConversationId(c.id);
    setHistoryKey((k) => k + 1);
    return c.id;
  }

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
    approvals?: string[];
  }) {
    const { baseMessages, userMsg, docs, mode, originalInputText } = opts;
    const approvals = opts.approvals ?? [];
    lastRunRef.current = { baseMessages, userMsg, docs, mode, approvals };
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
      const convId = await ensureConversation();

      // Save user message
      saveMsg({ data: { conversation_id: convId, role: "user", content: userMsg.content, mode } }).catch(() => {});

      // Extract facts in the background
      extractFacts({ data: { message: userMsg.content } }).then((r) => {
        if (r.facts.length) setFacts((prev) => [...r.facts, ...prev].slice(0, 30));
      }).catch(() => {});

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          approvals,
          messages: payloadMessages,
          user: profile ? { name: profile.name, age: profile.age, birthday: profile.birthday ?? null, isBirthday, email: user?.email ?? null, isCreator: (user?.email ?? "").toLowerCase() === "tobyfemi55@gmail.com", facts: facts.slice(0, 15) } : undefined,
        }),
        signal: controller.signal,
      });

      // The agent streams NDJSON: step updates as it works, then one final payload.
      let data: any = null;
      const liveSteps: AgentStep[] = [];
      if (res.body && (res.headers.get("content-type") || "").includes("ndjson")) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: any;
            try { ev = JSON.parse(line); } catch { continue; }
            if (ev.type === "step") {
              const running = liveSteps.findIndex((s) => s.label === ev.label && s.state === "running");
              if (ev.state === "running") liveSteps.push({ label: ev.label, state: "running" });
              else if (running >= 0) liveSteps[running] = { label: ev.label, detail: ev.detail, state: ev.state };
              else liveSteps.push({ label: ev.label, detail: ev.detail, state: ev.state });
              const snapshot = liveSteps.map((s) => ({ ...s }));
              setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, steps: snapshot } : m)));
            } else if (ev.type === "remember") {
              storeFact({ data: { fact: ev.fact } })
                .then(() => setFacts((prev) => [ev.fact, ...prev]))
                .catch(() => {});
            } else if (ev.type === "task") {
              newTask({ data: { title: ev.title, instruction: ev.instruction, conversationId: conversationId ?? null } })
                .then((t: any) => {
                  setTasksKey((k) => k + 1);
                  return startTask({ data: { id: t.id } });
                })
                .then(() => setTasksKey((k) => k + 1))
                .catch(() => {});
            } else if (ev.type === "final") {
              data = ev;
            }
          }
        }
      } else {
        data = await res.json();
      }
      if (!data) throw new Error("The connection dropped mid-thought — try again?");
      if (Array.isArray(data?.logs)) {
        setDevLogs((prev) => [...prev, { t: Date.now(), level: "info", tag: "client", msg: `── request "${userMsg.content.slice(0, 60)}" ──` }, ...data.logs]);
      }
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      const reply: ChatMessage = {
        id: pendingId, role: "assistant",
        content: data.text || "",
        places: data.places ?? null,
        post: data.post ?? null,
        files: data.files ?? null,
        steps: (data.steps ?? liveSteps) as AgentStep[],
        approval: data.approval ?? null,
        mode,
      };
      setMessages([...nextMessages, reply]);
      if (data.places?.length > 0) setMapView({ places: data.places, summary: data.text || "" });
      if (data.post) setReader({ post: data.post, summary: data.text || "" });

      // Save assistant message + auto-title first turn
      saveMsg({
        data: {
          conversation_id: convId,
          role: "assistant",
          content: data.text || "",
          post: data.post ?? undefined,
          places: data.places ?? undefined,
          mode,
        },
      }).catch(() => {});
      if (baseMessages.length === 0) {
        const title = userMsg.content.slice(0, 60).trim() || "New chat";
        renameConvo({ data: { id: convId, title } }).then(() => setHistoryKey((k) => k + 1)).catch(() => {});
      }
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

  // The user OK'd a gated action: replay the same turn with that tool authorized.
  function approvePending(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    const run = lastRunRef.current;
    if (!msg?.approval || !run || busy) return;
    const tool = msg.approval.tool;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, approvalHandled: true } : m)));
    runChat({
      baseMessages: run.baseMessages,
      userMsg: run.userMsg,
      docs: run.docs,
      mode: run.mode,
      originalInputText: "",
      approvals: [...new Set([...run.approvals, tool])],
    });
  }

  function declinePending(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, approvalHandled: true } : m))
    );
    setTimeout(() => inputRef.current?.focus(), 0);
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

  function maybeAskToTrain(): boolean {
    const exchanges = messages.filter((m) => m.role === "user" || m.role === "assistant");
    if (exchanges.length < 4 || !conversationId) return false;
    // 3-day cooldown so Tobi doesn't pester
    try {
      const last = Number(localStorage.getItem("tobi:lastTrainPromptAt") || 0);
      if (Date.now() - last < 3 * 24 * 60 * 60 * 1000) return false;
      localStorage.setItem("tobi:lastTrainPromptAt", String(Date.now()));
    } catch {}
    setTrainPrompt({ convoId: conversationId, messages: exchanges });
    return true;
  }

  function resetChatState() {
    setMessages([]);
    setConversationId(null);
    setMapView(null);
    setReader(null);
    setInput("");
    setPendingDocs([]);
  }

  function newChat() {
    if (maybeAskToTrain()) return;
    resetChatState();
  }

  async function selectConversation(id: string) {
    setConversationId(id);
    setMapView(null);
    setReader(null);
    try {
      const msgs = await loadConvo({ data: { id } });
      const mapped: ChatMessage[] = (msgs as any[]).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        post: m.post ?? null,
        places: m.places ?? null,
        mode: m.mode ?? undefined,
      }));
      setMessages(mapped);
    } catch (e: any) {
      setMessages([{ id: uid(), role: "assistant", content: `⚠️ Couldn't load that chat: ${e?.message}` }]);
    }
  }

  async function onboard(data: { name: string; age: number; birthday: string }) {
    const updated = await saveProfile({ data: { name: data.name, age: data.age, birthday: data.birthday, onboarded: true } });
    setProfile(updated);
  }

  // Birthday check — compares MM-DD to today
  const isBirthday = (() => {
    if (!profile?.birthday) return false;
    const today = new Date();
    const bd = String(profile.birthday); // yyyy-mm-dd
    return bd.slice(5, 10) === `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  })();

  if (authLoading || profileLoading) {
    return (
      <div className="grid place-items-center h-[100dvh] bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <TobiLogo className="size-9 rounded-xl" markClassName="size-7" />
          Loading…
        </div>
      </div>
    );
  }

  const needsOnboarding = profile && !profile.onboarded;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground flex flex-col">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, var(--tobi-glow), transparent 60%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, oklch(0.55 0.22 270), transparent 60%)" }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/60 backdrop-blur-sm">
        <h1 className="sr-only">Tobi AI chat</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setHistoryOpen(true)} aria-label="Open chat history" className="size-9 grid place-items-center rounded-xl border border-border bg-card/60 hover:bg-card transition" title="Chats">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <TobiLogo className="size-9 rounded-xl" markClassName="size-7" />
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">Tobi</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">{profile?.name ? `for ${profile.name}` : "your interactive AI"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1.5 text-xs hover:bg-card transition" aria-label="Toggle theme">
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <UserMenu
            name={profile?.name ?? null}
            email={user?.email ?? null}
            onOpenHistory={() => setHistoryOpen(true)}
            onOpenMemory={() => setMemoryOpen(true)}
            onOpenTasks={() => setTasksOpen(true)}
            onNewChat={newChat}
          />
        </div>
      </header>

      <main ref={scrollRef} className="relative z-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="pt-12 text-center space-y-6">
              <TobiLogo className="mx-auto size-20 rounded-3xl" markClassName="size-14" />
              <div>
                <p className="font-display text-3xl font-semibold tracking-tight">
                  {isBirthday && profile?.name
                    ? `🎉 Happy birthday, ${profile.name}!`
                    : profile?.name
                      ? `Yo ${profile.name}, what's good?`
                      : "Hey, I'm Tobi."}
                </p>
                {isBirthday && (
                  <p className="mt-2 text-tobi text-sm font-medium">Wishing you the best one yet — go enjoy your day, I got the work covered. 🎂</p>
                )}
                <p className="mt-2 text-muted-foreground text-sm max-w-md mx-auto">
                  I write code, hunt bugs, dive deep into research, find places on a map, pull threads from anywhere, and read your Word / Excel docs.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto pt-4">
                {(() => {
                  const continueConvo = recentConvos.find((c) => c.id !== conversationId && c.title && c.title.toLowerCase() !== "new chat");
                  const promptCount = continueConvo ? 3 : 4;
                  const prompts = pickDailySuggestions(SUGGESTION_POOL, promptCount);
                  const tiles: ReactNode[] = prompts.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left rounded-xl border border-border bg-card/60 backdrop-blur px-4 py-3 text-sm hover:border-tobi/50 hover:bg-card transition"
                    >
                      {s}
                    </button>
                  ));
                  if (continueConvo) {
                    tiles.push(
                      <button
                        key={`continue-${continueConvo.id}`}
                        onClick={() => selectConversation(continueConvo.id)}
                        className="text-left rounded-xl border border-tobi/40 bg-tobi/10 backdrop-blur px-4 py-3 text-sm hover:border-tobi hover:bg-tobi/15 transition"
                      >
                        <div className="text-[10px] uppercase tracking-wider text-tobi/80 mb-0.5">Continue</div>
                        <div className="truncate">{continueConvo.title}</div>
                      </button>,
                    );
                  }
                  return tiles;
                })()}
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
            <label htmlFor="tobi-message-input" className="sr-only">Message Tobi</label>
            <textarea
              id="tobi-message-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              aria-label="Message Tobi"
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
              {busy ? (
                <button
                  onClick={stop}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition"
                  title="Stop generating"
                >
                  Stop
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim() && pendingDocs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-full bg-tobi text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Send
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              )}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground text-center mt-2">
            Tobi can make mistakes. Verify important info.
          </div>
        </div>
      </footer>

      {mapView && (
        <Suspense fallback={<div className="absolute inset-0 z-30 bg-background/80 backdrop-blur flex items-center justify-center text-sm text-muted-foreground">Loading map…</div>}>
          <MapOverlay places={mapView.places} summary={mapView.summary} onClose={() => setMapView(null)} />
        </Suspense>
      )}
      {reader && (
        <ReaderDock post={reader.post} summary={reader.summary} onClose={() => setReader(null)} />
      )}
      <DevConsole logs={devLogs} open={devOpen} onClose={() => setDevOpen(false)} onClear={() => setDevLogs([])} />

      <HistorySidebar
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        activeId={conversationId}
        onSelect={selectConversation}
        onNew={newChat}
        refreshKey={historyKey}
      />

      <TasksDrawer open={tasksOpen} onClose={() => setTasksOpen(false)} refreshKey={tasksKey} />

      <MemoryDrawer
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        name={profile?.name ?? null}
        onChange={setFacts}
      />

      {needsOnboarding && (
        <OnboardingModal initialName={profile?.name || (user?.user_metadata as any)?.name || ""} onSubmit={onboard} />
      )}

      {trainPrompt && (
        <TrainTobiModal
          onYes={async () => {
            try {
              await submitTraining({
                data: {
                  conversationId: trainPrompt.convoId,
                  messages: trainPrompt.messages.map((m) => ({ role: m.role, content: m.content })),
                },
              });
            } catch (e) {
              console.error("training submit failed", e);
            }
          }}
          onNo={() => { setTrainPrompt(null); resetChatState(); }}
        />
      )}
    </div>
  );
}
