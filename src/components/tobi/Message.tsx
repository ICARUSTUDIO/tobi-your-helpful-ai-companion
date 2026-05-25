import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TobiLogo } from "./TobiLogo";
import type { ChatMessage } from "./types";

export function Message({ m, onShowMap, onShowReader }: { m: ChatMessage; onShowMap?: () => void; onShowReader?: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-tobi/15 border border-tobi/30 px-4 py-2.5 text-sm text-foreground">
          {m.content}
          {m.attachments && m.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {m.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-background/40 border border-border px-2 py-0.5 text-[10px]">
                  📎 {a.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <TobiLogo className="size-8 shrink-0 rounded-full" markClassName="size-6" />
      <div className="flex-1 min-w-0">
        {m.mode === "research" && (
          <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-tobi font-semibold">
            <span className="size-1.5 rounded-full bg-tobi" /> Deep research
          </div>
        )}
        {m.pending ? (
          <div className="flex items-center gap-1 py-2">
            <span className="typing-dot size-2 rounded-full bg-tobi" />
            <span className="typing-dot size-2 rounded-full bg-tobi" />
            <span className="typing-dot size-2 rounded-full bg-tobi" />
          </div>
        ) : (
          <div className="prose-tobi text-sm text-foreground/95">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "_…_"}</ReactMarkdown>
          </div>
        )}
        {m.places && m.places.length > 0 && (
          <button
            onClick={onShowMap}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-card border border-tobi/40 px-3 py-2 text-xs font-medium text-tobi hover:bg-tobi/10 transition glow-ring"
          >
            <span className="size-1.5 rounded-full bg-tobi animate-pulse" />
            View {m.places.length} {m.places.length === 1 ? "place" : "places"} on map →
          </button>
        )}
        {m.post && (
          <button
            onClick={onShowReader}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-card border border-tobi/40 px-3 py-2 text-xs font-medium text-tobi hover:bg-tobi/10 transition glow-ring"
          >
            <span className="size-1.5 rounded-full bg-tobi animate-pulse" />
            Open reader: "{m.post.title.slice(0, 50)}{m.post.title.length > 50 ? "…" : ""}" →
          </button>
        )}
      </div>
    </div>
  );
}
