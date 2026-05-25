import { useState } from "react";
import { TobiLogo } from "./TobiLogo";

interface Props {
  onYes: () => Promise<void> | void;
  onNo: () => void;
}

export function TrainTobiModal({ onYes, onNo }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleYes() {
    setSubmitting(true);
    try {
      await onYes();
      setDone(true);
      setTimeout(onNo, 1400);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <TobiLogo className="size-12 rounded-2xl" markClassName="size-8" />
          <div>
            <div className="font-display text-lg font-semibold">Mind if I learn from this?</div>
            <div className="text-xs text-muted-foreground">It helps me get smarter for everyone.</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {done
            ? "Thanks 🙏 — sent to Tobi's creator for review."
            : "If you say yes, this chat goes to Tobi's creator who reviews it and turns the useful bits into something Tobi can learn from. Your name and personal details are stripped out."}
        </p>
        {!done && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={onNo}
              disabled={submitting}
              className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted transition disabled:opacity-50"
            >
              No thanks
            </button>
            <button
              onClick={handleYes}
              disabled={submitting}
              className="flex-1 rounded-full bg-tobi text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Yes, learn from it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
