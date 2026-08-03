import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TobiLogo } from "@/components/tobi/TobiLogo";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Tobi AI — your interactive AI bro" },
      { name: "description", content: "Tobi AI is a personalized AI assistant that codes, debugs, researches, finds places on a map, and remembers what matters." },
      { property: "og:title", content: "Tobi AI — your interactive AI bro" },
      { property: "og:description", content: "Tobi AI codes, debugs, researches, finds places on a map, and remembers what matters." },
      { property: "og:url", content: "https://t-obi.xyz/" },
    ],
    links: [{ rel: "canonical", href: "https://t-obi.xyz/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Tobi AI",
              url: "https://t-obi.xyz/",
              email: "tobyfemi@proton.me",
            },
            {
              "@type": "WebSite",
              name: "Tobi AI",
              url: "https://t-obi.xyz/",
              description: "Personalized, interactive AI assistant that codes, debugs, researches, finds places, and remembers what matters.",
            },
            {
              "@type": "SoftwareApplication",
              name: "Tobi AI",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://t-obi.xyz/",
              description: "Personal AI assistant for coding, debugging, deep research, interactive maps, and long-term memory.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            },
          ],
        }),
      },
    ],
  }),
});

function LandingPage() {
  const navigate = useNavigate();

  // After a full-page Google redirect the user lands back here; as soon as the
  // session is hydrated, send them into the app instead of leaving them on the
  // marketing page (which looked like a blank/no-op sign-in).
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      navigate({ to: "/app", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { if (s) go(); });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, var(--tobi-glow), transparent 60%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[600px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, oklch(0.55 0.22 270), transparent 60%)" }} />

      <header className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TobiLogo className="size-9 rounded-xl" markClassName="size-6" />
          <span className="font-display text-lg font-semibold">Tobi AI</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/login" className="rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/login" className="rounded-full bg-tobi text-primary-foreground px-4 py-1.5 font-medium hover:opacity-90">Get started</Link>
        </nav>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-tobi" /> Meet Tobi AI
        </div>
        <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold leading-tight">
          Your AI bro that actually <span className="text-tobi">gets you</span>.
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          Tobi AI is a personalized, interactive assistant that writes code, debugs, runs deep research,
          finds places on an interactive map, reads documents with you, and remembers the things that matter —
          so every conversation picks up where the last one left off.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/login" className="rounded-full bg-tobi text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90">Start chatting</Link>
          <a href="#features" className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-card/60">What it does</a>
        </div>

        <section id="features" className="mt-24 grid sm:grid-cols-2 gap-4 text-left">
          {[
            { t: "Codes & debugs", d: "Writes, explains, and fixes code across stacks. Paste a stack trace, get a real answer." },
            { t: "Deep research", d: "Goes beyond a single search — synthesizes sources into something you can actually use." },
            { t: "Interactive map", d: "Find places, plan trips, and explore neighborhoods on a live map inside the chat." },
            { t: "Remembers you", d: "Learns your name, your projects, your preferences — only with your consent." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5">
              <div className="font-display text-base font-semibold">{f.t}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-3xl border border-border bg-card/60 backdrop-blur p-8 text-left">
          <h2 className="font-display text-2xl font-semibold">What is Tobi AI?</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Tobi AI is a personal AI assistant built for people who want a more human, less corporate
            chatbot. Sign in with email or Google to start a conversation, train Tobi on the facts that
            matter to you, and come back any time — your history and memories stay with you. Built and
            maintained by Toby (contact: <a href="mailto:tobyfemi@proton.me" className="underline">tobyfemi@proton.me</a>).
          </p>
        </section>
      </main>

      <footer className="relative max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border">
        <div>© {new Date().getFullYear()} Tobi AI</div>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <a href="mailto:tobyfemi@proton.me" className="hover:text-foreground">Contact</a>
        </div>
      </footer>
    </div>
  );
}
