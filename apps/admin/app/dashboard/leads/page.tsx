"use client";

import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";

interface Lead {
  id: string;
  projectId: string;
  name: string; email: string; phone: string; company?: string;
  source?: string; pipelineStage: string; tags: string[];
  notes: { text: string; createdAt: string }[];
  followUps: { text: string; dueAt?: string; done: boolean; createdAt: string }[];
  contacted: boolean; contactedAt?: any;
  sessionId?: string; vars?: Record<string, string>;
  createdAt: any;
}

const PIPELINE_STAGES = [
  { key: "new", label: "New", color: "bg-yellow-900 text-yellow-300" },
  { key: "contacted", label: "Contacted", color: "bg-blue-900 text-blue-300" },
  { key: "qualified", label: "Qualified", color: "bg-indigo-900 text-indigo-300" },
  { key: "proposal", label: "Proposal", color: "bg-purple-900 text-purple-300" },
  { key: "negotiation", label: "Negotiation", color: "bg-pink-900 text-pink-300" },
  { key: "won", label: "Won", color: "bg-green-900 text-green-300" },
  { key: "lost", label: "Lost", color: "bg-red-900 text-red-300" },
];

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const db = getDb$();
    if (!db) return;
    const unsubLeads = onSnapshot(collection(db, "leads"), (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
    });
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, name: d.data().projectName || d.id })));
    });
    return () => { unsubLeads(); unsubProjects(); };
  }, []);

  const filtered = projectFilter ? leads.filter((l) => l.projectId === projectFilter) : leads;
  const grouped = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, filtered.filter((l) => (l.pipelineStage || "new") === s.key)]));

  const updateStage = async (id: string, stage: string) => {
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, pipelineStage: stage }) });
  };

  const addNote = async () => {
    if (!noteInput.trim() || !selected) return;
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, note: noteInput.trim() }) });
    setNoteInput("");
  };

  const addFollowUp = async () => {
    if (!followUpInput.trim() || !selected) return;
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, followUp: { text: followUpInput.trim() } }) });
    setFollowUpInput("");
  };

  const addTag = async (tag: string) => {
    if (!tag.trim() || !selected) return;
    const current = selected.tags || [];
    if (current.includes(tag)) return;
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, tags: [...current, tag] }) });
    setTagInput("");
  };

  const removeTag = async (tag: string) => {
    if (!selected) return;
    await fetch("/api/leads", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, tags: (selected.tags || []).filter((t) => t !== tag) }) });
  };

  const exportCsv = useCallback(() => {
    const rows = [["Name", "Email", "Phone", "Company", "Source", "Stage", "Tags", "Date"]];
    for (const l of filtered) {
      rows.push([l.name, l.email, l.phone, l.company ?? "", l.source ?? "", l.pipelineStage, (l.tags || []).join("; "), l.createdAt ? new Date((l.createdAt as any).seconds * 1000).toISOString() : ""]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `crm-${new Date().toISOString().split("T")[0]}.csv`; a.click();
  }, [filtered]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">CRM</h1>
        <div className="flex items-center gap-2">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none">
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-neutral-700 overflow-hidden text-sm">
            <button onClick={() => setView("pipeline")} className={`px-3 py-1.5 ${view === "pipeline" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"}`}>Pipeline</button>
            <button onClick={() => setView("table")} className={`px-3 py-1.5 ${view === "table" ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400"}`}>Table</button>
          </div>
          <button onClick={exportCsv} className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-400 hover:text-white">Export</button>
        </div>
      </div>

      {view === "pipeline" ? (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
          {PIPELINE_STAGES.map((stage) => {
            const items = grouped[stage.key] || [];
            return (
              <div key={stage.key} className="flex-1 min-w-[200px] rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stage.color}`}>{stage.label}</span>
                  <span className="text-xs text-neutral-500">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((lead) => (
                    <div key={lead.id} onClick={() => setSelected(lead)}
                      className="cursor-pointer rounded-lg border border-neutral-800 bg-neutral-950 p-3 transition hover:border-indigo-500/30">
                      <p className="text-sm font-medium">{lead.name}</p>
                      <p className="text-xs text-neutral-500">{lead.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(lead.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{t}</span>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-600">
                        {lead.createdAt?.toDate?.().toLocaleDateString() || ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-400">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">Stage</th>
                <th className="pb-2 pr-4">Tags</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} onClick={() => setSelected(l)} className="cursor-pointer border-b border-neutral-800/50 transition hover:bg-neutral-900/30">
                  <td className="py-2 pr-4 font-medium">{l.name}</td>
                  <td className="py-2 pr-4 text-neutral-400">{l.email}</td>
                  <td className="py-2 pr-4 text-neutral-400">{l.phone}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${PIPELINE_STAGES.find((s) => s.key === (l.pipelineStage || "new"))?.color || "bg-neutral-800 text-neutral-400"}`}>
                      {l.pipelineStage || "new"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {(l.tags || []).slice(0, 3).map((t) => <span key={t} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{t}</span>)}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-neutral-500">{l.source || "—"}</td>
                  <td className="py-2 text-xs text-neutral-500">{l.createdAt?.toDate?.().toLocaleDateString() || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="mt-4 text-sm text-neutral-500">No leads found.</p>}
        </div>
      )}

      {/* ── Lead Detail Drawer ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-neutral-950 border-l border-neutral-800 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-white text-xl">&times;</button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div><span className="text-neutral-500">Email</span><p>{selected.email}</p></div>
              <div><span className="text-neutral-500">Phone</span><p>{selected.phone}</p></div>
              <div><span className="text-neutral-500">Company</span><p>{selected.company || "—"}</p></div>
              <div><span className="text-neutral-500">Source</span><p>{selected.source || "—"}</p></div>
            </div>

            {/* Pipeline Stage */}
            <div className="mb-6">
              <label className="text-xs uppercase text-neutral-500 mb-2 block">Pipeline Stage</label>
              <div className="flex flex-wrap gap-1">
                {PIPELINE_STAGES.map((s) => (
                  <button key={s.key} onClick={() => updateStage(selected.id, s.key)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${(selected.pipelineStage || "new") === s.key ? s.color + " ring-2 ring-white/20" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="mb-6">
              <label className="text-xs uppercase text-neutral-500 mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(selected.tags || []).map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    {t}
                    <button onClick={() => removeTag(t)} className="text-neutral-500 hover:text-red-400">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag(tagInput)}
                  placeholder="Add tag..." className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-indigo-500" />
                <button onClick={() => addTag(tagInput)} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">+</button>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="text-xs uppercase text-neutral-500 mb-2 block">Notes</label>
              <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                {(selected.notes || []).slice().reverse().map((n, i) => (
                  <div key={i} className="rounded bg-neutral-900 p-2">
                    <p className="text-xs text-neutral-300">{n.text}</p>
                    <p className="text-[10px] text-neutral-600 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {(selected.notes || []).length === 0 && <p className="text-xs text-neutral-500">No notes yet</p>}
              </div>
              <div className="flex gap-1">
                <input value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  placeholder="Add note..." className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-indigo-500" />
                <button onClick={addNote} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">Add</button>
              </div>
            </div>

            {/* Follow-ups */}
            <div className="mb-6">
              <label className="text-xs uppercase text-neutral-500 mb-2 block">Follow-ups</label>
              <div className="space-y-2 mb-2 max-h-32 overflow-y-auto">
                {(selected.followUps || []).slice().reverse().map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-neutral-900 p-2">
                    <span className={`text-xs ${f.done ? "text-neutral-600 line-through" : "text-neutral-300"}`}>{f.text}</span>
                    <span className="text-[10px] text-neutral-600">{new Date(f.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
                {(selected.followUps || []).length === 0 && <p className="text-xs text-neutral-500">No follow-ups</p>}
              </div>
              <div className="flex gap-1">
                <input value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFollowUp()}
                  placeholder="Add follow-up..." className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs outline-none focus:border-indigo-500" />
                <button onClick={addFollowUp} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">Add</button>
              </div>
            </div>

            {/* Conversation History */}
            <div className="mb-6">
              <label className="text-xs uppercase text-neutral-500 mb-2 block">Conversation History</label>
              {selected.sessionId ? (
                <ConversationHistory sessionId={selected.sessionId} />
              ) : (
                <p className="text-xs text-neutral-500">No conversation linked</p>
              )}
            </div>

            {/* Collected Variables */}
            {selected.vars && Object.keys(selected.vars).length > 0 && (
              <div>
                <label className="text-xs uppercase text-neutral-500 mb-2 block">Collected Data</label>
                <div className="space-y-1">
                  {Object.entries(selected.vars).map(([k, v]) => (
                    <div key={k} className="flex justify-between rounded bg-neutral-900 px-2 py-1 text-xs">
                      <span className="text-neutral-400">{k}</span>
                      <span className="text-neutral-200">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationHistory({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      const res = await fetch(`/api/debug/knowledge?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        // Fallback: try reading session from Firestore directly
        const db = getDb$();
        if (!db) return;
        const snap = await import("firebase/firestore").then((m) => m.getDoc(m.doc(db, "sessions", sessionId)));
        if (snap.exists()) {
          setMessages(snap.data().history || []);
        }
      }
    };
    load();
  }, [sessionId]);

  if (messages.length === 0) return <p className="text-xs text-neutral-500">Loading conversation...</p>;
  return (
    <div className="max-h-48 overflow-y-auto space-y-1">
      {messages.slice(-20).map((m, i) => (
        <div key={i} className={`rounded px-2 py-1 text-xs ${m.role === "user" ? "bg-indigo-900/30 text-indigo-200" : "bg-neutral-800 text-neutral-300"}`}>
          <span className="text-[10px] text-neutral-500 mr-1">{m.role === "user" ? "👤" : "🤖"}</span>
          {m.message}
        </div>
      ))}
    </div>
  );
}
