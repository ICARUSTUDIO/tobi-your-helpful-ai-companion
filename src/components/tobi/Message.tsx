import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "./types";

export function Message({ m, onShowMap }: { m: ChatMessage; onShowMap?: () => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-tobi/15 border border-tobi/30 px-4 py-2.5 text-sm text-foreground">
          {m.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="size-8 shrink-0 rounded-full tobi-orb grid place-items-center text-[10px] font-bold text-background">T</div>
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
      </div>
    </div>
  );
}
