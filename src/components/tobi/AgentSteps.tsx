import type { AgentStep } from "./types";

export function AgentSteps({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="mb-2 flex flex-col gap-1">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span aria-hidden className="shrink-0">
            {s.state === "running" ? (
              <span className="inline-block size-2 rounded-full bg-tobi animate-pulse" />
            ) : s.state === "failed" ? (
              <span className="inline-block size-2 rounded-full bg-red-400" />
            ) : (
              <span className="inline-block size-2 rounded-full bg-tobi/50" />
            )}
          </span>
          <span className={s.state === "failed" ? "line-through" : undefined}>{s.label}</span>
          {s.detail && <span className="truncate opacity-60">— {s.detail}</span>}
        </div>
      ))}
    </div>
  );
}
