"use client";

import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState } from "react";

interface FailedQuery {
  id: string;
  projectId: string;
  query: string;
  timestamp: { toDate: () => Date };
  sessionId?: string;
}

export default function FailedQueriesPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [queries, setQueries] = useState<FailedQuery[]>([]);
  const [converting, setConverting] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb$();
    if (!db) return;
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, name: d.data().projectName || d.id })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) { setQueries([]); return; }
    const db = getDb$();
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, "failed_queries"), where("projectId", "==", selected), orderBy("timestamp", "desc"), limit(100)),
      (snap) => { setQueries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FailedQuery))); }
    );
    return unsub;
  }, [selected]);

  const convert = async (q: FailedQuery, type: "faq" | "flow", answer: string) => {
    setConverting(q.id);
    try {
      await fetch("/api/failed-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failedQueryId: q.id,
          projectId: selected,
          type,
          question: q.query,
          answer,
          triggers: q.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
        }),
      });
    } finally { setConverting(null); }
  };

  const dismiss = async (q: FailedQuery) => {
    await fetch("/api/failed-queries", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id }),
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Failed Query Review</h1>
          <p className="mt-1 text-sm text-neutral-500">Review unanswered questions and convert them into FAQ entries or conversation flows</p>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none">
          <option value="">Select a project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {queries.map((q) => (
          <div key={q.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-red-300">&ldquo;{q.query}&rdquo;</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {q.timestamp?.toDate().toLocaleString()} {q.sessionId && `· Session: ${q.sessionId.slice(0, 20)}…`}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => { const a = prompt("Answer for FAQ:", ""); if (a) convert(q, "faq", a); }}
                disabled={converting === q.id}
                className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600 disabled:opacity-40">
                + Add as FAQ
              </button>
              <button onClick={() => { const a = prompt("Flow response:", ""); if (a) convert(q, "flow", a); }}
                disabled={converting === q.id}
                className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
                + Create Flow
              </button>
              <button onClick={() => dismiss(q)}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800">
                Dismiss
              </button>
            </div>
          </div>
        ))}
        {queries.length === 0 && selected && (
          <p className="text-sm text-neutral-500">No failed queries — your chatbot is answering everything!</p>
        )}
      </div>
    </div>
  );
}
