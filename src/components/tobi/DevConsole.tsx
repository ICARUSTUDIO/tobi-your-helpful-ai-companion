import { useEffect, useRef, useState } from "react";

export type DevLog = { t: number; level: "info" | "warn" | "error"; tag: string; msg: string; data?: any };

interface Props {
  logs: DevLog[];
  open: boolean;
  onClose: () => void;
  onClear: () => void;
}

const LEVEL_COLOR: Record<DevLog["level"], string> = {
  info: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-rose-400",
};

export function DevConsole({ logs, open, onClose, onClear }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState("");
  const [autoscroll, setAutoscroll] = useState(true);

  useEffect(() => {
    if (open && autoscroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, open, autoscroll]);

  if (!open) return null;

  const filtered = filter
    ? logs.filter((l) => (l.tag + l.msg + JSON.stringify(l.data ?? "")).toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] h-[40vh] border-t-2 border-emerald-500/30 bg-black/95 backdrop-blur-xl text-emerald-200 font-mono text-[11px] flex flex-col shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-emerald-500/20 bg-black/80">
        <span className="text-emerald-400 font-semibold">▶ tobi-dev</span>
        <span className="text-emerald-700">·</span>
        <span className="text-emerald-600">{filtered.length} entries</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter… (e.g. reddit, error)"
          className="ml-2 flex-1 bg-emerald-950/50 border border-emerald-500/20 rounded px-2 py-0.5 text-emerald-100 placeholder:text-emerald-700 outline-none focus:border-emerald-400/40"
        />
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input type="checkbox" checked={autoscroll} onChange={(e) => setAutoscroll(e.target.checked)} className="accent-emerald-500" />
          autoscroll
        </label>
        <button onClick={onClear} className="px-2 py-0.5 rounded hover:bg-emerald-500/10 text-emerald-400">clear</button>
        <button onClick={onClose} className="px-2 py-0.5 rounded hover:bg-rose-500/10 text-rose-300">close ✕</button>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-emerald-700 italic">No logs yet. Logs from the AI&apos;s tool calls (Reddit, Places, AI gateway) appear here in real time. Toggle with Ctrl+`.</div>
        ) : filtered.map((l, i) => {
          const time = new Date(l.t).toISOString().slice(11, 23);
          return (
            <div key={i} className="leading-snug whitespace-pre-wrap break-words">
              <span className="text-emerald-700">{time}</span>{" "}
              <span className={LEVEL_COLOR[l.level]}>{l.level.toUpperCase().padEnd(5)}</span>{" "}
              <span className="text-cyan-300">{l.tag}</span>{" "}
              <span className="text-emerald-100">{l.msg}</span>
              {l.data !== undefined && <span className="text-emerald-500/70"> {JSON.stringify(l.data)}</span>}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1 border-t border-emerald-500/10 text-[10px] text-emerald-700 bg-black/80">
        Hidden developer console · toggle: Ctrl/Cmd + ` · not visible to end users
      </div>
    </div>
  );
}
