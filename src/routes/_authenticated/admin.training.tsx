import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
    await review({ data: { id, decision: "approved", fact } });
    await refresh();
  }
  async function reject(id: string) {
    await review({ data: { id, decision: "rejected" } });
    await refresh();
  }
  async function delKnow(id: string) {
    if (!confirm("Delete this knowledge item?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <div className="p-10 text-center text-muted-foreground">Admins only.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Tobi training review</h1>
          <p className="text-xs text-muted-foreground">Approve or reject what Tobi learns.</p>
        </div>
        <Link to="/" className="text-sm text-tobi hover:underline">← Back to Tobi</Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Pending submissions ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">Nothing waiting.</div>
          ) : (
            <div className="space-y-4">
              {pending.map((row) => (
                <div key={row.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="text-[11px] text-muted-foreground">{new Date(row.created_at).toLocaleString()}</div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">AI-summarized fact (edit before approving)</label>
                    <textarea
                      value={drafts[row.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-tobi"
                      placeholder="No summary generated — write one or reject."
                    />
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View raw chat ({(row.raw_messages as any[])?.length ?? 0} msgs)</summary>
                    <div className="mt-2 max-h-60 overflow-y-auto rounded-lg bg-background border border-border p-3 space-y-2">
                      {(row.raw_messages as any[]).map((m, i) => (
                        <div key={i}>
                          <span className="font-semibold text-tobi">{m.role}:</span>{" "}
                          <span className="text-muted-foreground whitespace-pre-wrap">{m.content?.slice(0, 500)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                  <div className="flex gap-2">
                    <button onClick={() => reject(row.id)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">Reject</button>
                    <button onClick={() => approve(row.id)} className="rounded-full bg-tobi text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90">Approve & teach Tobi</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-3">Tobi's global knowledge ({knowledge.length})</h2>
          {knowledge.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">No facts approved yet.</div>
          ) : (
            <ul className="space-y-2">
              {knowledge.map((k) => (
                <li key={k.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                  <span>{k.fact}</span>
                  <button onClick={() => delKnow(k.id)} className="text-xs text-red-400 hover:underline shrink-0">delete</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
