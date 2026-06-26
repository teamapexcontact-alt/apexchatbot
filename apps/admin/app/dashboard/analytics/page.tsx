"use client";

import { collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"];
type Range = "24h" | "7d" | "30d" | "all";

export default function AnalyticsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [failed, setFailed] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [range, setRange] = useState<Range>("7d");

  const getSince = (r: Range) => {
    if (r === "all") return 0;
    return { "24h": 86400000, "7d": 604800000, "30d": 2592000000 }[r];
  };

  useEffect(() => {
    const db = getDb$()!;
    const since = getSince(range);
    const ts = since > 0 ? Timestamp.fromMillis(Date.now() - since) : null;
    const timeConstraint = ts ? where("timestamp", ">=", ts) : null;

    const fetchAll = async () => {
      const [eventSnap, flowSnap, leadSnap, failedSnap, sessSnap] = await Promise.all([
        getDocs(query(collection(db, "analytics_events"), orderBy("timestamp", "desc"), ...(timeConstraint ? [timeConstraint] : []), limit(5000))),
        getDocs(query(collection(db, "flows"), where("enabled", "==", true))),
        getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"), ...(timeConstraint ? [timeConstraint] : []), limit(2000))),
        getDocs(query(collection(db, "failed_queries"), orderBy("timestamp", "desc"), ...(timeConstraint ? [timeConstraint] : []), limit(500))),
        getDocs(query(collection(db, "sessions"))),
      ]);

      setEvents(eventSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFlows(flowSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLeads(leadSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFailed(failedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSessions(sessSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchAll();
  }, [range]);

  // ── Event Stats ──
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.eventType || e.event] = (counts[e.eventType || e.event] || 0) + 1;
    return counts;
  }, [events]);

  // ── Daily Data ──
  const dailyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of events) {
      const ts = e.timestamp?.toMillis?.() || e.timestamp?.seconds * 1000 || Date.now();
      const day = new Date(ts).toISOString().split("T")[0];
      if (!map[day]) map[day] = {};
      map[day][e.eventType || e.event] = (map[day][e.eventType || e.event] || 0) + 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, types]) => ({ date: date.slice(5), ...types }));
  }, [events]);

  // ── Conversion Funnel ──
  const funnel = useMemo(() => {
    const chatOpen = stats.chat_open || 0;
    const messages = stats.message_sent || 0;
    const leadsCount = leads.length;
    const contacted = leads.filter((l) => l.contacted).length;
    return [
      { name: "Chat Opens", value: chatOpen },
      { name: "Messages", value: messages },
      { name: "Leads", value: leadsCount },
      { name: "Contacted", value: contacted },
    ];
  }, [stats, leads]);

  // ── Top Flows / Intents ──
  const topFlows = useMemo(() => {
    const triggerCount: Record<string, { name: string; count: number; id: string }> = {};
    for (const e of events) {
      if (e.eventType === "flow_triggered" || e.data?.flowName) {
        const name = e.data?.flowName || e.data?.intent || "unknown";
        if (!triggerCount[name]) triggerCount[name] = { name, count: 0, id: e.data?.flowId || "" };
        triggerCount[name].count++;
      }
    }
    return Object.values(triggerCount).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [events]);

  // ── Failed Queries (top unanswered) ──
  const topFailed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of failed) {
      const q = (f.query || "").toLowerCase().trim();
      if (q) counts[q] = (counts[q] || 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([query, count]) => ({ query, count }));
  }, [failed]);

  // ── Session Duration ──
  const sessionStats = useMemo(() => {
    const durations: number[] = [];
    for (const s of sessions) {
      if (s.startedAt && s.lastActivity) {
        const d = s.lastActivity - s.startedAt;
        if (d > 0 && d < 86400000) durations.push(d);
      }
    }
    const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const median = durations.length > 0 ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)] : 0;
    return { count: durations.length, avgMs: avg, medianMs: median, avgMin: Math.round(avg / 60000 * 10) / 10, medianMin: Math.round(median / 60000 * 10) / 10 };
  }, [sessions]);

  // ── Lead Sources ──
  const leadSources = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) {
      const src = l.source || "widget";
      counts[src] = (counts[src] || 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
  }, [leads]);

  // ── Flow Trigger Counts ──
  const flowTriggerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const flowId = e.data?.flowId;
      if (flowId) counts[flowId] = (counts[flowId] || 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([flowId, count]) => {
      const flow = flows.find((f) => f.id === flowId);
      return { name: flow?.name || flowId.slice(0, 12), count };
    });
  }, [events, flows]);

  const typeBreakdown = Object.entries(stats).map(([name, value]) => ({ name, value }));

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

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Chat Opens", value: stats.chat_open ?? 0, color: "text-indigo-400" },
          { label: "Messages", value: stats.message_sent ?? 0, color: "text-cyan-400" },
          { label: "Sessions", value: sessionStats.count, color: "text-purple-400" },
          { label: "Avg Duration", value: `${sessionStats.avgMin}m`, color: "text-emerald-400" },
          { label: "Leads", value: leads.length, color: "text-green-400" },
          { label: "Failed Qs", value: failed.length, color: "text-red-400" },
          { label: "Flows", value: flows.length, color: "text-amber-400" },
          { label: "Events", value: events.length, color: "text-white" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Events Over Time */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Events Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#ccc" }} />
              <Bar dataKey="chat_open" fill="#6366f1" radius={[4, 4, 0, 0]} name="Opens" />
              <Bar dataKey="message_sent" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Funnel */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnel.map((stage, i) => {
              const prevVal = i > 0 ? funnel[i - 1].value : stage.value;
              const pct = prevVal > 0 ? Math.round((stage.value / prevVal) * 100) : 0;
              const overallPct = funnel[0].value > 0 ? Math.round((stage.value / funnel[0].value) * 100) : 0;
              return (
                <div key={stage.name} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-400">{stage.name}</span>
                    <span className="text-xs text-neutral-300 font-medium">{stage.value} ({overallPct}%)</span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${overallPct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  {i > 0 && <span className="text-[10px] text-neutral-600">from previous: {pct}%</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {/* Event Breakdown */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Event Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {typeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Flow Triggers */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Top Flows</h2>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {flowTriggerCounts.map((f, i) => (
              <div key={f.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-neutral-500 shrink-0 w-4">{i + 1}.</span>
                  <span className="text-xs text-neutral-300 truncate">{f.name}</span>
                </div>
                <span className="text-xs font-mono text-indigo-400">{f.count}</span>
              </div>
            ))}
            {flowTriggerCounts.length === 0 && <p className="text-xs text-neutral-500">No flow data yet</p>}
          </div>
        </div>

        {/* Lead Sources */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Lead Sources</h2>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {leadSources.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-xs text-neutral-300">{s.name}</span>
                <span className="text-xs font-mono text-green-400">{s.value}</span>
              </div>
            ))}
            {leadSources.length === 0 && <p className="text-xs text-neutral-500">No leads yet</p>}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Daily Trend */}
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

        {/* Top Failed Queries */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-300">Top Missed Questions</h2>
            <a href="/dashboard/failed-queries" className="text-xs text-indigo-400 hover:underline">Review all</a>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {topFailed.map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-red-300 truncate flex-1 min-w-0">"{f.query}"</span>
                <span className="text-xs font-mono text-neutral-500 ml-2">×{f.count}</span>
              </div>
            ))}
            {topFailed.length === 0 && <p className="text-xs text-neutral-500">No missed questions!</p>}
          </div>
        </div>
      </div>

      {/* Session Duration Detail */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Session Metrics</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div><p className="text-xs text-neutral-500">Total Sessions</p><p className="text-lg font-semibold text-white">{sessionStats.count}</p></div>
          <div><p className="text-xs text-neutral-500">Avg Duration</p><p className="text-lg font-semibold text-cyan-400">{sessionStats.avgMin}m</p></div>
          <div><p className="text-xs text-neutral-500">Median Duration</p><p className="text-lg font-semibold text-emerald-400">{sessionStats.medianMin}m</p></div>
          <div><p className="text-xs text-neutral-500">Avg Messages/Session</p><p className="text-lg font-semibold text-amber-400">{sessionStats.count > 0 ? Math.round((stats.message_sent || 0) / sessionStats.count) : 0}</p></div>
        </div>
      </div>
    </div>
  );
}
