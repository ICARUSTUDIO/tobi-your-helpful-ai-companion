import type { Approval } from "./types";

export function ApprovalCard({
  approval,
  disabled,
  onApprove,
  onDecline,
}: {
  approval: Approval;
  disabled?: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-tobi/40 bg-tobi/5 p-3.5 text-sm">
      <div className="font-medium text-foreground">{approval.title}</div>

      {approval.tool === "propose_plan" ? (
        <div className="mt-2">
          {approval.goal && <div className="text-xs text-muted-foreground mb-1.5">{approval.goal}</div>}
          <ol className="list-decimal pl-5 space-y-1 text-[13px] text-foreground/90">
            {approval.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-1.5 text-[13px] text-foreground/90">{approval.detail}</div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={disabled}
          className="rounded-full bg-tobi px-3.5 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50 transition"
        >
          {approval.tool === "propose_plan" ? "Go ahead" : approval.tool === "remember" ? "Save it" : "Run it"}
        </button>
        <button
          onClick={onDecline}
          disabled={disabled}
          className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 transition"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
