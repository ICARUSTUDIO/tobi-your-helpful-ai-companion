import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TobiLogo } from "./TobiLogo";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { ChatMessage } from "./types";

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center size-7 rounded-full text-muted-foreground hover:text-tobi hover:bg-tobi/10 transition"
    >
      {children}
    </button>
  );
}

export function Message({
  m,
  onShowMap,
  onShowReader,
  onRetry,
  onEdit,
  onDeepDive,
  pendingPromptText,
  pendingPromptMode,
}: {
  m: ChatMessage;
  onShowMap?: () => void;
  onShowReader?: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  onDeepDive?: () => void;
  pendingPromptText?: string;
  pendingPromptMode?: "normal" | "research";
}) {
  if (m.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1 group">
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
        {(onRetry || onEdit || onDeepDive) && (
          <div className="flex items-center gap-0.5 opacity-70 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition">
            {onEdit && (
              <IconBtn title="Edit prompt" onClick={onEdit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </IconBtn>
            )}
            {onRetry && (
              <IconBtn title="Retry" onClick={onRetry}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
              </IconBtn>
            )}
            {onDeepDive && (
              <IconBtn title="Deep dive" onClick={onDeepDive}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
              </IconBtn>
            )}
          </div>
        )}
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
          <ThinkingIndicator prompt={pendingPromptText || ""} mode={pendingPromptMode || m.mode || "normal"} />
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
