import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listPendingSubmissions,
  reviewSubmission,
  listGlobalKnowledge,
  deleteKnowledge,
  checkIsAdmin,
} from "@/lib/training.functions";

export const Route = createFileRoute("/_authenticated/admin/training")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AdminTrainingPage,
});

type Tab = "queue" | "knowledge";

function AdminTrainingPage() {
  const checkAdmin = useServerFn(checkIsAdmin);
  const fetchPending = useServerFn(listPendingSubmissions);
  const fetchKnowledge = useServerFn(listGlobalKnowledge);
  const review = useServerFn(reviewSubmission);
  const remove = useServerFn(deleteKnowledge);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("queue");
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const [p, k] = await Promise.all([fetchPending(), fetchKnowledge()]);
    setPending(p as any);
    setKnowledge(k as any);
    const d: Record<string, string> = {};
    (p as any[]).forEach((row) => { d[row.id] = row.ai_summary ?? ""; });
    setDrafts(d);
  }

  useEffect(() => {
    (async () => {
      const { isAdmin } = await checkAdmin();
      setIsAdmin(isAdmin);
      if (isAdmin) await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id: string) {
    const fact = drafts[id]?.trim();
    if (!fact) return alert("Edit the fact first.");
    setBusy(id);
    try {
      await review({ data: { id, decision: "approved", fact } });
      await refresh();
    } finally { setBusy(null); }
  }
  async function reject(id: string) {
    setBusy(id);
    try {
      await review({ data: { id, decision: "rejected" } });
      await refresh();
    } finally { setBusy(null); }
  }
  async function delKnow(id: string) {
    if (!confirm("Delete this knowledge item?")) return;
    setBusy(id);
    try {
      await remove({ data: { id } });
      await refresh();
    } finally { setBusy(null); }
  }

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newToday = pending.filter((p) => new Date(p.created_at) >= today).length;
    return { pending: pending.length, knowledge: knowledge.length, newToday };
  }, [pending, knowledge]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center text-sm">
        Loading admin…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">
        <div className="text-center space-y-3">
          <div className="text-2xl font-semibold">Admins only</div>
          <Link to="/app" className="text-sm text-sky-400 hover:underline">← Back to Tobi</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="text-xs uppercase tracking-widest text-slate-500">Admin</div>
          <div className="font-semibold text-lg mt-1">Tobi Control</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <button
            onClick={() => setTab("queue")}
            className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between ${tab === "queue" ? "bg-sky-500/15 text-sky-300" : "text-slate-300 hover:bg-slate-800/60"}`}
          >
            <span>Review queue</span>
            {stats.pending > 0 && <span className="text-[10px] bg-sky-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full">{stats.pending}</span>}
          </button>
          <button
            onClick={() => setTab("knowledge")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${tab === "knowledge" ? "bg-sky-500/15 text-sky-300" : "text-slate-300 hover:bg-slate-800/60"}`}
          >
            Knowledge base
          </button>
        </nav>
        <div className="p-3 border-t border-slate-800">
          <Link to="/app" className="block text-xs text-slate-500 hover:text-slate-300 px-3 py-2">← Back to Tobi</Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between bg-slate-900/30 backdrop-blur">
          <div>
            <h1 className="font-semibold text-lg">{tab === "queue" ? "Review queue" : "Knowledge base"}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {tab === "queue" ? "Decide what Tobi gets to learn." : "Facts Tobi uses to answer everyone."}
            </p>
          </div>
          <button onClick={refresh} className="text-xs rounded-md border border-slate-700 px-3 py-1.5 hover:bg-slate-800">Refresh</button>
        </header>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-3 px-6 pt-6">
          <StatCard label="Pending review" value={stats.pending} accent="sky" />
          <StatCard label="New today" value={stats.newToday} accent="amber" />
          <StatCard label="Approved facts" value={stats.knowledge} accent="emerald" />
        </div>

        <div className="px-6 py-6 flex-1 overflow-y-auto">
          {tab === "queue" ? (
            pending.length === 0 ? (
              <EmptyState title="Inbox zero" subtitle="Nothing waiting for review." />
            ) : (
              <div className="space-y-3">
                {pending.map((row) => (
                  <article key={row.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-500">{(row.raw_messages as any[])?.length ?? 0} msgs</div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Distilled fact</label>
                      <textarea
                        value={drafts[row.id] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 text-slate-100"
                        placeholder="No summary generated - write one or reject."
                      />
                    </div>
                    <details className="text-xs group">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-300 select-none">View raw transcript</summary>
                      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-2">
                        {(row.raw_messages as any[]).map((m, i) => (
                          <div key={i}>
                            <span className="font-semibold text-sky-400">{m.role}:</span>{" "}
                            <span className="text-slate-400 whitespace-pre-wrap">{m.content?.slice(0, 800)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                    <div className="flex gap-2 justify-end">
                      <button
                        disabled={busy === row.id}
                        onClick={() => reject(row.id)}
                        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={busy === row.id}
                        onClick={() => approve(row.id)}
                        className="rounded-md bg-sky-500 text-slate-950 px-3 py-1.5 text-xs font-semibold hover:bg-sky-400 disabled:opacity-50"
                      >
                        {busy === row.id ? "Saving…" : "Approve & teach"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : knowledge.length === 0 ? (
            <EmptyState title="No facts yet" subtitle="Approve submissions to fill Tobi's brain." />
          ) : (
            <ul className="space-y-2">
              {knowledge.map((k) => (
                <li key={k.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
                  <span className="text-slate-200">{k.fact}</span>
                  <button
                    disabled={busy === k.id}
                    onClick={() => delKnow(k.id)}
                    className="text-xs text-rose-400 hover:underline shrink-0 disabled:opacity-50"
                  >
                    delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: "sky" | "amber" | "emerald" }) {
  const tone = accent === "sky" ? "text-sky-400" : accent === "amber" ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center">
      <div className="text-slate-300 font-medium">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}
