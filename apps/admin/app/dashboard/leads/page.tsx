"use client";

import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { Lead } from "@apex/shared";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "contacted">("all");
  const [projectFilter, setProjectFilter] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(getDb$()!, "leads"), (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
    });
    return unsub;
  }, []);

  const markContacted = useCallback(async (id: string) => {
    await updateDoc(doc(getDb$()!, "leads", id), { contacted: true });
  }, []);

  const exportCsv = useCallback(() => {
    const rows = [["Name", "Email", "Phone", "Company", "Source", "Contacted", "Date"]];
    for (const l of leads) {
      rows.push([l.name, l.email, l.phone, l.company ?? "", l.source ?? "", l.contacted ? "Yes" : "No", l.createdAt ? new Date((l.createdAt as any).seconds * 1000).toISOString() : ""]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [leads]);

  const filtered = useMemo(() => {
    let items = leads;
    if (projectFilter) items = items.filter((l) => l.projectId === projectFilter);
    if (filter === "new") items = items.filter((l) => !l.contacted);
    else if (filter === "contacted") items = items.filter((l) => l.contacted);
    return items;
  }, [leads, filter, projectFilter]);

  const projects = [...new Set(leads.map((l) => l.projectId).filter(Boolean))];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex rounded-lg border border-neutral-700 overflow-hidden text-sm">
            {(["all", "new", "contacted"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 ${filter === f ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400 hover:text-white"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition">
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Phone</th>
              <th className="pb-2 pr-4">Company</th>
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Project</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-b border-neutral-800/50">
                <td className="py-2 pr-4">{l.name}</td>
                <td className="py-2 pr-4 text-neutral-400">{l.email}</td>
                <td className="py-2 pr-4 text-neutral-400">{l.phone}</td>
                <td className="py-2 pr-4 text-neutral-400">{l.company || "—"}</td>
                <td className="py-2 pr-4 text-neutral-400">{l.source || "—"}</td>
                <td className="py-2 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${l.contacted ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`}>
                    {l.contacted ? "Contacted" : "New"}
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs text-neutral-500">{l.projectId}</td>
                <td className="py-2">
                  {!l.contacted && (
                    <button onClick={() => markContacted(l.id!)} className="text-xs text-indigo-400 hover:underline">
                      Mark Contacted
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="mt-4 text-sm text-neutral-500">No leads found.</p>}
      </div>
    </div>
  );
}
