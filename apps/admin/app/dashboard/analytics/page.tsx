"use client";

import { collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];

type Range = "24h" | "7d" | "30d" | "all";

export default function AnalyticsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [range, setRange] = useState<Range>("7d");

  const fetchEvents = useCallback(async () => {
    const db = getDb$()!;
    const now = Date.now();
    const rangeMap: Record<Range, number> = { "24h": 86400000, "7d": 604800000, "30d": 2592000000, all: 0 };
    const since = rangeMap[range];
    const constraints: any[] = since > 0 ? [where("timestamp", ">=", Timestamp.fromMillis(now - since))] : [];
    const q = query(collection(db, "analytics_events"), orderBy("timestamp", "desc"), ...constraints, limit(5000));
    const snap = await getDocs(q);
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, [range]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const t = e.eventType as string;
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [events]);

  const dailyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of events) {
      const ts = (typeof e.timestamp?.toMillis === "function" ? e.timestamp.toMillis() : (e.timestamp?.seconds ? e.timestamp.seconds * 1000 : Date.now()));
      const day = new Date(ts).toISOString().split("T")[0];
      if (!map[day]) map[day] = {};
      map[day][e.eventType] = (map[day][e.eventType] || 0) + 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, types]) => ({
      date: date.slice(5),
      ...types,
    }));
  }, [events]);

  const typeBreakdown = useMemo(() => {
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const totalEvents = events.length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex rounded-lg border border-neutral-700 overflow-hidden text-sm">
          {(["24h", "7d", "30d", "all"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 ${range === r ? "bg-indigo-600 text-white" : "bg-neutral-900 text-neutral-400 hover:text-white"}`}>
              {r === "24h" ? "24H" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Total Events", value: totalEvents, color: "text-white" },
          { label: "Chat Opens", value: stats.chat_open ?? 0, color: "text-indigo-400" },
          { label: "Messages Sent", value: stats.message_sent ?? 0, color: "text-cyan-400" },
          { label: "Leads Captured", value: stats.lead_submitted ?? 0, color: "text-green-400" },
          { label: "CTA Clicks", value: stats.cta_clicked ?? 0, color: "text-amber-400" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Events Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#ccc" }}
              />
              <Bar dataKey="chat_open" fill="#6366f1" radius={[4, 4, 0, 0]} name="Chat Opens" />
              <Bar dataKey="message_sent" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Event Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {typeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Daily Trend (Messages)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyData}>
            <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} />
            <YAxis tick={{ fill: "#888", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="message_sent" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
