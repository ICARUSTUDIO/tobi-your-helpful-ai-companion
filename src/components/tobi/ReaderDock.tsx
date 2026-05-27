import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TobiLogo } from "./TobiLogo";
import type { RedditPost } from "./types";

type Mode = "expanded" | "docked" | "hidden";
const PAGE = 5;
const VOICE_LABEL = "Sage · OpenAI";

interface Props {
  post: RedditPost;
  summary: string;
  onClose: () => void;
}

function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceName] = useState<string>(VOICE_LABEL);
  const [intensity, setIntensity] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);
  const onDoneRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { hardStop(); }, []);

  function stopRaf() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function hardStop() {
    cancelledRef.current = true;
    const a = audioRef.current;
    if (a) {
      try { a.pause(); a.src = ""; a.load(); } catch {}
    }
    audioRef.current = null;
    stopRaf();
    setIntensity(0);
    setSpeaking(false);
    setPaused(false);
  }

  function startFakeAnalyser() {
    let t = 0;
    const tick = () => {
      t += 0.12;
      const base = 0.35 + Math.sin(t) * 0.18 + Math.sin(t * 2.3) * 0.12;
      setIntensity(Math.max(0.1, Math.min(1, base + Math.random() * 0.15)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function playOne(text: string): Promise<boolean> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (cancelledRef.current) return false;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = "auto";
    audioRef.current = audio;
    try {
      if (!pausedRef.current) await audio.play();
      startFakeAnalyser();
    } catch { URL.revokeObjectURL(url); return false; }
    return await new Promise<boolean>((resolve) => {
      const cleanup = () => { stopRaf(); URL.revokeObjectURL(url); };
      audio.onended = () => { cleanup(); resolve(true); };
      audio.onerror = () => { cleanup(); resolve(false); };
      const checkCancel = () => {
        if (cancelledRef.current) { cleanup(); resolve(false); }
      };
      audio.onpause = checkCancel;
    });
  }

  async function speak(chunks: string[], onDone?: () => void) {
    hardStop();
    cancelledRef.current = false;
    pausedRef.current = false;
    onDoneRef.current = onDone || null;
    setSpeaking(true);

    for (let i = 0; i < chunks.length; i++) {
      if (cancelledRef.current) return;
      let ok = false;
      try { ok = await playOne(chunks[i]); } catch { ok = false; }
      if (cancelledRef.current) return;
      if (!ok) {
        setSpeaking(false);
        setIntensity(0);
        onDoneRef.current?.();
        return;
      }
    }
    setSpeaking(false);
    setIntensity(0);
    onDoneRef.current?.();
  }

  function pause() {
    pausedRef.current = true;
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch {} }
    stopRaf();
    setPaused(true);
  }
  function resume() {
    pausedRef.current = false;
    const a = audioRef.current;
    if (a) {
      a.play().then(() => startFakeAnalyser()).catch(() => {});
    }
    setPaused(false);
  }
  function stop() { hardStop(); onDoneRef.current = null; }

  return { speaking, paused, voiceName, intensity, speak, pause, resume, stop };
}


function chunkText(s: string, max = 1200): string[] {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const sents = clean.split(/(?<=[.!?])\s+/);
  const out: string[] = []; let buf = "";
  for (const x of sents) {
    if ((buf + " " + x).length > max) { if (buf) out.push(buf); buf = x; }
    else buf = buf ? buf + " " + x : x;
  }
  if (buf) out.push(buf);
  return out;
}

export function ReaderDock({ post, summary, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("expanded");
  const [shown, setShown] = useState(PAGE);
  const [showTutorial, setShowTutorial] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState<{ id: string; text: string }[]>([]);
  const [askMore, setAskMore] = useState(false);
  const [askComments, setAskComments] = useState(false);
  const tts = useTTS();

  const totalComments = post.comments.length;
  const visible = useMemo(() => post.comments.slice(0, shown), [post.comments, shown]);

  function listen() {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("tobi-listen-tutorial")) {
      setShowTutorial(true);
      return;
    }
    startListening();
  }

  function startListening() {
    setShowTutorial(false);
    localStorage.setItem("tobi-listen-tutorial", "1");
    const take = (summary || "").trim();
    if (!take && !post.body && post.comments.length === 0) {
      addNote("_Nothing here to read aloud yet._");
      return;
    }
    const parts: string[] = [];
    if (take) parts.push(`Tobi's take. ${take}`);
    if (post.title) parts.push(`Now the post itself. ${post.title}.`);
    if (post.body) parts.push(post.body);
    if (post.comments.length > 0) {
      parts.push(`And here are the top ${Math.min(PAGE, post.comments.length)} comments.`);
      post.comments.slice(0, PAGE).forEach((c, i) => {
        parts.push(`Comment ${i + 1}. ${c.author} said: ${c.body}`);
      });
      setShown(Math.max(shown, PAGE));
    }
    const allChunks = parts.flatMap((p) => chunkText(p));
    tts.speak(allChunks, () => {
      if (post.comments.length > PAGE) setAskMore(true);
    });
  }

  function listenComments(from = 0, count = PAGE) {
    setAskComments(false); setAskMore(false);
    const slice = post.comments.slice(from, from + count);
    if (slice.length === 0) return;
    setShown(Math.max(shown, from + count));
    const text = slice.map((c, i) => `Comment ${from + i + 1}. ${c.author} said: ${c.body}`).join(" ... ");
    tts.speak(chunkText(text), () => {
      const next = from + count;
      if (next < totalComments) setAskMore(true);
    });
  }

  function searchComments(q: string) {
    const needle = q.toLowerCase();
    const hit = post.comments.findIndex((c) => c.body.toLowerCase().includes(needle));
    if (hit === -1) {
      addNote(`I searched all ${totalComments} loaded comments for "${q}" — no match. Want me to load more from Reddit?`);
    } else {
      setShown(Math.max(shown, hit + 1));
      addNote(`Found it in comment ${hit + 1} by **${post.comments[hit].author}**: "${post.comments[hit].body.slice(0, 200)}${post.comments[hit].body.length > 200 ? "…" : ""}"`);
      setTimeout(() => {
        document.getElementById(`tobi-cmt-${post.comments[hit].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }

  function addNote(text: string) {
    setNotes((n) => [...n, { id: Math.random().toString(36).slice(2), text }]);
  }

  function handleFollowUp() {
    const t = followUp.trim(); if (!t) return;
    setFollowUp("");
    addNote(`**You:** ${t}`);
    // Smart local intent: search / read more / stop
    const low = t.toLowerCase();
    if (/(stop|pause)/.test(low)) { tts.stop(); addNote("_Stopped reading._"); return; }
    if (/(resume|continue)/.test(low) && tts.paused) { tts.resume(); return; }
    if (/(more comment|next comment|read more)/.test(low)) { listenComments(shown, PAGE); return; }
    if (/(find|search|look for|comment about|mention)/.test(low)) {
      const m = t.match(/(?:find|search|look for|about|mention(?:s|ing)?)\s+(.+)/i);
      const q = m?.[1]?.replace(/[?.!]$/, "").trim() || t;
      searchComments(q);
      return;
    }
    addNote(`_Tip: try "find a comment about X", "read more comments", or "stop"._`);
  }

  if (mode === "hidden") return null;

  // Docked = floating pill in top-right
  if (mode === "docked") {
    const i = tts.intensity;
    const glow = tts.speaking
      ? {
          borderColor: `rgba(34, 197, 94, ${0.5 + i * 0.5})`,
          boxShadow: `0 0 ${8 + i * 24}px ${1 + i * 3}px rgba(34, 197, 94, ${0.25 + i * 0.55})`,
        }
      : undefined;
    return (
      <div className="fixed top-4 right-4 z-40 max-w-[320px]">
        <button
          onClick={() => setMode("expanded")}
          style={glow}
          className={`flex items-center gap-2 rounded-full bg-card/95 backdrop-blur-xl border pl-3 pr-4 py-2 shadow-2xl hover:bg-card transition-[background,transform] group ${tts.speaking ? "" : "border-tobi/40 glow-ring"}`}
        >
          <span
            className={`size-2 rounded-full ${tts.speaking ? "bg-green-400" : "bg-muted-foreground"}`}
            style={tts.speaking ? { transform: `scale(${1 + i * 0.8})`, transition: "transform 80ms linear" } : undefined}
          />
          <div className="text-left min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: tts.speaking ? "rgb(34, 197, 94)" : undefined }}>Thinking cap</div>
            <div className="text-xs text-foreground truncate max-w-[220px]">{post.title}</div>
          </div>
        </button>
        {askMore && (
          <div className="mt-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-tobi/50 p-3 shadow-2xl glow-ring">
            <p className="text-xs text-foreground/90">Done with that batch. Want me to read the next 5 comments?</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => { setMode("expanded"); listenComments(shown, PAGE); }} className="flex-1 rounded-full bg-tobi text-primary-foreground text-xs font-semibold py-1.5 hover:opacity-90">Yes, keep going</button>
              <button onClick={() => setAskMore(false)} className="rounded-full border border-border text-xs px-3 py-1.5 hover:bg-card">Later</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {showTutorial && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm animate-in fade-in" onClick={() => setShowTutorial(false)}>
          <div className="max-w-md mx-4 rounded-3xl bg-card border border-tobi/40 p-6 shadow-2xl glow-ring" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <TobiLogo className="size-10 rounded-2xl" markClassName="size-8" />
              <div className="font-display text-lg font-semibold">Meet the Listen button</div>
            </div>
            <p className="mt-4 text-sm text-foreground/85 leading-relaxed">
              Hit <b>Listen</b> and I'll read you <b>my take</b> on this thread — not the raw post, just the summary I wrote.
              When I'm done, I'll offer to read the top comments too. You can minimize this panel and keep chatting;
              I'll ping you from the top-right when I need an answer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowTutorial(false)} className="rounded-full border border-border px-4 py-1.5 text-xs hover:bg-muted">Maybe later</button>
              <button onClick={startListening} className="rounded-full bg-tobi text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:opacity-90">Got it, start listening</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 bottom-4 w-[min(420px,calc(100vw-2rem))] z-40 flex flex-col rounded-3xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`size-2 rounded-full ${tts.speaking ? "bg-tobi animate-pulse" : "bg-tobi/50"}`} />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-tobi font-semibold">Thinking cap · {post.source === "reddit" ? `r/${post.subreddit}` : post.source}</div>
              <div className="text-xs text-muted-foreground truncate">{post.source === "reddit" ? `by u/${post.author}` : post.subreddit || post.author} · {post.numComments ?? totalComments} replies</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setMode("docked")} title="Minimize" className="rounded-full size-7 grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground">–</button>
            <button onClick={() => { tts.stop(); onClose(); }} title="Close" className="rounded-full size-7 grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
          </div>
        </div>

        {/* Listen bar */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-tobi/5">
          {!tts.speaking ? (
            <button onClick={listen} className="flex items-center gap-2 rounded-full bg-tobi text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              Listen
            </button>
          ) : (
            <>
              <button onClick={tts.paused ? tts.resume : tts.pause} className="rounded-full border border-tobi/60 px-3 py-1.5 text-xs hover:bg-tobi/10">{tts.paused ? "Resume" : "Pause"}</button>
              <button onClick={tts.stop} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">Stop</button>
              <span className="text-[10px] text-muted-foreground ml-1 truncate">{tts.paused ? "Paused" : `Reading · ${tts.voiceName}`}</span>
            </>
          )}
          <a href={post.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-tobi hover:underline">Open original ↗</a>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
          {summary && (
            <div className="rounded-2xl bg-tobi/5 border border-tobi/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-tobi font-semibold mb-1">Tobi's take</div>
              <div className="prose-tobi text-xs text-foreground/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
              </div>
            </div>
          )}

          <div>
            <h2 className="font-display text-base font-semibold leading-snug">{post.title}</h2>
            {post.body && (
              <div className="prose-tobi text-sm text-foreground/90 mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
              </div>
            )}
          </div>

          {post.related && post.related.length > 1 && (
            <div className="border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Related links</div>
              <div className="space-y-2">
                {post.related.slice(0, 6).map((hit) => (
                  <a key={hit.url} href={hit.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-border bg-background/40 p-3 hover:border-tobi/40 transition">
                    <div className="text-xs font-medium text-foreground leading-snug">{hit.title}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground truncate">{(() => { try { return new URL(hit.url).hostname.replace(/^www\./, ""); } catch { return hit.url; } })()}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Comments · showing {Math.min(shown, totalComments)} of {totalComments}
            </div>
            <div className="space-y-2">
              {visible.map((c) => (
                <div
                  key={c.id}
                  id={`tobi-cmt-${c.id}`}
                  className="rounded-xl bg-background/40 border border-border p-3"
                  style={{ marginLeft: `${Math.min(c.depth, 4) * 10}px` }}
                >
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">u/{c.author}</span>
                    <span>· {c.score} pts</span>
                  </div>
                  <div className="prose-tobi text-xs text-foreground/90 mt-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            {shown < totalComments && (
              <button
                onClick={() => setShown((s) => Math.min(s + PAGE, totalComments))}
                className="mt-3 w-full rounded-xl border border-tobi/40 bg-tobi/5 py-2 text-xs font-medium text-tobi hover:bg-tobi/10"
              >
                Load {Math.min(PAGE, totalComments - shown)} more comments
              </button>
            )}
          </div>

          {/* Inline Tobi notes (search results, prompts) */}
          {notes.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-tobi/10 border border-tobi/30 p-2.5 text-xs text-foreground/90">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.text}</ReactMarkdown>
                </div>
              ))}
            </div>
          )}

          {askComments && (
            <div className="rounded-2xl border border-tobi/50 bg-tobi/10 p-3 glow-ring">
              <p className="text-xs">Done with the post. Want me to read the first 5 comments?</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => listenComments(0, PAGE)} className="flex-1 rounded-full bg-tobi text-primary-foreground text-xs font-semibold py-1.5 hover:opacity-90">Yes, read comments</button>
                <button onClick={() => setAskComments(false)} className="rounded-full border border-border text-xs px-3 py-1.5 hover:bg-card">No thanks</button>
              </div>
            </div>
          )}
          {askMore && (
            <div className="rounded-2xl border border-tobi/50 bg-tobi/10 p-3 glow-ring">
              <p className="text-xs">Want me to read the next 5 comments?</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => listenComments(shown, PAGE)} className="flex-1 rounded-full bg-tobi text-primary-foreground text-xs font-semibold py-1.5 hover:opacity-90">Keep going</button>
                <button onClick={() => setAskMore(false)} className="rounded-full border border-border text-xs px-3 py-1.5 hover:bg-card">Stop</button>
              </div>
            </div>
          )}
        </div>

        {/* Reader-local input */}
        <div className="border-t border-border bg-background/40 p-3">
          <div className="rounded-2xl border border-border bg-card p-1.5 flex items-center gap-1">
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleFollowUp(); }}
              placeholder='Ask Tobi about this post… ("find comment about X")'
              className="flex-1 bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
            />
            <button onClick={handleFollowUp} className="rounded-full bg-tobi text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90">Ask</button>
          </div>
        </div>
      </div>
    </>
  );
}
