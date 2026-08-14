import { useEffect, useState } from "react";

type Phase = { label: string; minMs: number };

function inferPhases(prompt: string, mode: "normal" | "research"): Phase[] {
  const p = prompt.toLowerCase();
  const isPlaces = /\b(near|where|find a|find me|restaurant|cafe|coffee|bar|hotel|map|location|address|landmark|in [A-Z])/i.test(prompt);
  const isSocial = /(reddit|twitter|\bx\.com|instagram|facebook|tiktok|youtube|threads|linkedin|quora|hacker ?news|thread|post|tweet|what.*sa(y|ying))/i.test(p);
  const isCode = /(code|function|debug|error|typeerror|stack ?trace|bug|refactor|implement|script|api|regex)/i.test(p);
  const isDoc = /(attached|document|word|excel|spreadsheet|docx|xlsx|csv)/i.test(p);

  const base: Phase[] = [{ label: "Reading your message", minMs: 0 }];
  if (isDoc) base.push({ label: "Parsing your document", minMs: 400 });
  base.push({ label: mode === "research" ? "Mapping out a deep dive" : "Thinking it through", minMs: 700 });
  if (isPlaces) base.push({ label: "Finding places on the map", minMs: 1400 });
  if (isSocial) base.push({ label: "Pulling threads from across the web", minMs: 1400 });
  if (isCode) base.push({ label: "Drafting the code", minMs: 1800 });
  if (mode === "research") base.push({ label: "Cross-checking findings", minMs: 2600 });
  base.push({ label: "Polishing the answer", minMs: 3600 });
  return base;
}

export function ThinkingIndicator({ prompt, mode }: { prompt: string; mode: "normal" | "research" }) {
  const [elapsed, setElapsed] = useState(0);
  const phases = inferPhases(prompt, mode);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(id);
  }, []);

  const current = [...phases].reverse().find((p) => elapsed >= p.minMs) ?? phases[0];
  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className="relative flex items-center justify-center size-5">
        <span className="absolute inline-flex size-5 rounded-full bg-tobi/30 animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-tobi" />
      </div>
      <span className="text-sm text-foreground/80 font-medium">{current.label}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{seconds}s</span>
    </div>
  );
}
