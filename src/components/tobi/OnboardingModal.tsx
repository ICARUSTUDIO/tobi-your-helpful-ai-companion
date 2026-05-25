import { useState } from "react";
import { TobiLogo } from "./TobiLogo";

interface Props {
  initialName?: string;
  onSubmit: (data: { name: string; age: number; birthday: string }) => Promise<void>;
}

export function OnboardingModal({ initialName, onSubmit }: Props) {
  const [name, setName] = useState(initialName || "");
  const [age, setAge] = useState<string>("");
  const [birthday, setBirthday] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ageNum = parseInt(age, 10);
    if (!name.trim()) return setErr("What should I call you?");
    if (!ageNum || ageNum < 5 || ageNum > 120) return setErr("Drop a real age, fam.");
    if (!birthday) return setErr("When's the birthday though?");
    const bd = new Date(birthday);
    if (isNaN(bd.getTime()) || bd > new Date()) return setErr("That birthday looks off.");
    setBusy(true); setErr(null);
    try {
      await onSubmit({ name: name.trim(), age: ageNum, birthday });
    } catch (e: any) {
      setErr(e?.message || "Couldn't save that, try again?");
    } finally {
      setBusy(false);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-md px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-tobi/40 bg-card p-7 shadow-2xl glow-ring">
        <div className="flex items-center gap-3">
          <TobiLogo className="size-12 rounded-2xl" markClassName="size-9" />
          <div>
            <div className="font-display text-xl font-semibold">Hey, before we get into it…</div>
            <div className="text-xs text-muted-foreground">A few quick things so I can actually know you.</div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">What should I call you?</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tobi" autoFocus className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tobi" maxLength={60} />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">How old are you?</span>
            <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 24" inputMode="numeric" className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tobi" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">When's your birthday?</span>
            <input
              type="date"
              value={birthday}
              max={todayIso}
              onChange={(e) => setBirthday(e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tobi"
            />
          </label>
        </div>
        {err && <div className="mt-3 text-xs text-red-400">{err}</div>}
        <button disabled={busy} className="mt-5 w-full rounded-full bg-tobi text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : "Let's go"}
        </button>
        <p className="mt-3 text-[10px] text-muted-foreground text-center">Stays between us. You can change it later in settings.</p>
      </form>
    </div>
  );
}
