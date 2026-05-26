import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { TobiLogo } from "@/components/tobi/TobiLogo";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in to Tobi AI" },
      { name: "description", content: "Sign in or create your Tobi AI account to chat with your personal AI bro — code, research, maps, and memory in one place." },
      { property: "og:title", content: "Sign in to Tobi AI" },
      { property: "og:description", content: "Sign in or create your Tobi AI account to start chatting with your personal AI bro." },
      { property: "og:url", content: "https://t-obi.xyz/login" },
    ],
    links: [{ rel: "canonical", href: "https://t-obi.xyz/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/app" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function withGoogle() {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setErr(r.error.message || "Google sign-in failed");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name: name.trim() || null }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background text-foreground px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, var(--tobi-glow), transparent 60%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, oklch(0.55 0.22 270), transparent 60%)" }} />
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-7 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <TobiLogo className="size-14 rounded-2xl" markClassName="size-10" />
          <h1 className="font-display text-2xl font-semibold mt-3">{mode === "signin" ? "Welcome back" : "Meet Tobi"}</h1>
          <p className="text-xs text-muted-foreground mt-1">{mode === "signin" ? "Your AI bro is waiting." : "Let's get you set up."}</p>
        </div>
        <button onClick={withGoogle} className="w-full rounded-full border border-border bg-background/60 hover:bg-background py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition">
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34.2 7.1 29.4 5 24 5c-7.7 0-14.3 4.4-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.2c-2 1.5-4.6 2.5-7.4 2.5-5.3 0-9.6-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.3 5.2C41.8 35.5 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-3 my-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <label htmlFor="login-name" className="sr-only">Your name</label>
              <input id="login-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tobi" />
            </>
          )}
          <label htmlFor="login-email" className="sr-only">Email</label>
          <input id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@anywhere.com (Proton works too)" aria-label="Email" className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tobi" />
          <label htmlFor="login-password" className="sr-only">Password</label>
          <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} placeholder="Password" aria-label="Password" className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-tobi" />
          {err && <div className="text-xs text-red-400">{err}</div>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-tobi text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground underline underline-offset-2">Terms of Service</Link>
          <span>&middot;</span>
          <Link to="/privacy" className="hover:text-foreground underline underline-offset-2">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
