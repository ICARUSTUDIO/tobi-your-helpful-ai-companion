import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TobiLogo } from "./TobiLogo";
import type { RedditPost } from "./types";

type Mode = "expanded" | "docked" | "hidden";
const PAGE = 5;

interface Props {
  post: RedditPost;
  summary: string;
  onClose: () => void;
}

function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceName, setVoiceName] = useState<string>("Natural browser voice");
  const [intensity, setIntensity] = useState(0); // 0..1, pulses on each spoken word
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const onDoneRef = useRef<(() => void) | null>(null);
  const decayRef = useRef<number | null>(null);

  useEffect(() => () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    if (decayRef.current) cancelAnimationFrame(decayRef.current);
  }, []);

  function startDecay() {
    if (decayRef.current) cancelAnimationFrame(decayRef.current);
    const tick = () => {
      setIntensity((v) => Math.max(0, v - 0.04));
      decayRef.current = requestAnimationFrame(tick);
    };
    decayRef.current = requestAnimationFrame(tick);
  }
  function stopDecay() {
    if (decayRef.current) cancelAnimationFrame(decayRef.current);
    decayRef.current = null;
    setIntensity(0);
  }

  function speak(chunks: string[], onDone?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    onDoneRef.current = onDone || null;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) => /natural|premium|enhanced|neural|samantha|ava|alloy|google us english|microsoft aria/i.test(v.name))
      || voices.find((v) => /^en[-_]/i.test(v.lang) && !/compact|novelty|whisper|bells|bad news/i.test(v.name))
      || voices[0];
    if (preferredVoice) setVoiceName(preferredVoice.name);
    chunks.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      if (preferredVoice) u.voice = preferredVoice;
      u.rate = 0.92;
      u.pitch = 0.96;
      u.volume = 0.92;
      u.onboundary = () => setIntensity(0.6 + Math.random() * 0.4);
      if (i === chunks.length - 1) {
        u.onend = () => { setSpeaking(false); setPaused(false); stopDecay(); onDoneRef.current?.(); };
      }
      queueRef.current.push(u);
      window.speechSynthesis.speak(u);
    });
    setSpeaking(true); setPaused(false);
    startDecay();
  }
  function pause() { window.speechSynthesis.pause(); setPaused(true); stopDecay(); }
  function resume() { window.speechSynthesis.resume(); setPaused(false); startDecay(); }
  function stop() { window.speechSynthesis.cancel(); setSpeaking(false); setPaused(false); stopDecay(); }
  return { speaking, paused, voiceName, intensity, speak, pause, resume, stop };
}

function chunkText(s: string, max = 140): string[] {
  const sents = s.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
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
    if (!take) {
      addNote("_I don't have a take written yet for this one — nothing to read aloud._");
      return;
    }
    tts.speak(chunkText(`Tobi's take. ${take}`), () => {
      if (post.comments.length > 0) setAskComments(true);
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
    return (
      <div className="fixed top-4 right-4 z-40 max-w-[320px]">
        <button
          onClick={() => setMode("expanded")}
          className="flex items-center gap-2 rounded-full bg-card/95 backdrop-blur-xl border border-tobi/40 pl-3 pr-4 py-2 shadow-2xl glow-ring hover:bg-card transition group"
        >
          <span className={`size-2 rounded-full ${tts.speaking ? "bg-tobi animate-pulse" : "bg-muted-foreground"}`} />
          <div className="text-left min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-tobi font-semibold">Thinking cap</div>
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
              <span className="text-[10px] text-muted-foreground ml-1 truncate">{tts.paused ? "Paused" : `Reading slowly · ${tts.voiceName}`}</span>
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
