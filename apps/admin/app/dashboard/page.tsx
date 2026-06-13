"use client";

import { collection, getCountFromServer, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

export default function DashboardOverview() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const db = getDb$()!;
    const cols = ["projects", "faqs", "leads", "conversations"] as const;
    const results: Record<string, number> = {};
    for (const col of cols) {
      const snap = await getCountFromServer(collection(db, col));
      results[col] = snap.data().count;
    }
    setCounts(results);

    const leadSnap = await getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(5)));
    setRecentLeads(leadSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cards = [
    { label: "Total Projects", key: "projects", href: "/dashboard/projects", color: "text-indigo-400" },
    { label: "Total FAQs", key: "faqs", href: "/dashboard/faqs", color: "text-cyan-400" },
    { label: "Total Leads", key: "leads", href: "/dashboard/leads", color: "text-green-400" },
    { label: "Conversations", key: "conversations", href: "/dashboard/analytics", color: "text-amber-400" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.key} href={card.href} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 transition">
            <p className="text-sm text-neutral-400">{card.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${card.color}`}>
              {counts[card.key] ?? "—"}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Recent Leads</h2>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-neutral-500">No leads yet.</p>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg bg-neutral-950 p-2 text-sm">
                  <div>
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 text-neutral-500">{l.email}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${l.contacted ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`}>
                    {l.contacted ? "Contacted" : "New"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/dashboard/leads" className="mt-3 inline-block text-xs text-indigo-400 hover:underline">
            View all leads →
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/dashboard/projects" className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-center text-sm text-neutral-300 hover:bg-neutral-800 transition">
              + New Project
            </Link>
            <Link href="/dashboard/faqs" className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-center text-sm text-neutral-300 hover:bg-neutral-800 transition">
              + Add FAQ
            </Link>
            <Link href="/dashboard/documents" className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-center text-sm text-neutral-300 hover:bg-neutral-800 transition">
              + Upload Doc
            </Link>
            <Link href="/dashboard/leads" className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-center text-sm text-neutral-300 hover:bg-neutral-800 transition">
              View Leads
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
