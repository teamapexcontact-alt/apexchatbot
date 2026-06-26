import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

// GET — aggregate analytics data for a project
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const range = req.nextUrl.searchParams.get("range") || "7d";
    const sinceMap: Record<string, number> = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
    const since = sinceMap[range] ? Timestamp.fromMillis(Date.now() - sinceMap[range]) : null;

    const constraints: any[] = projectId ? [where("projectId", "==", projectId)] : [];
    const timeCons = since ? [where("timestamp", ">=", since)] : [];

    const [eventSnap, leadSnap, failedSnap, sessionSnap] = await Promise.all([
      getDocs(query(collection(db(), "analytics_events"), ...constraints, ...timeCons, orderBy("timestamp", "desc"), limit(5000))),
      getDocs(query(collection(db(), "leads"), ...constraints, orderBy("createdAt", "desc"), limit(2000))),
      getDocs(query(collection(db(), "failed_queries"), ...constraints, orderBy("timestamp", "desc"), limit(500))),
      getDocs(query(collection(db(), "sessions"))),
    ]);

    const events = eventSnap.docs.map((d) => d.data());
    const eventCounts: Record<string, number> = {};
    for (const e of events) eventCounts[e.eventType || e.event] = (eventCounts[e.eventType || e.event] || 0) + 1;

    const leadsData = leadSnap.docs.map((d) => d.data());
    const failedData = failedSnap.docs.map((d) => d.data());
    const sessionsData = sessionSnap.docs.map((d) => d.data());

    // Session duration
    let avgDuration = 0;
    if (sessionsData.length > 0) {
      const durations = sessionsData
        .map((s: any) => s.lastActivity && s.startedAt ? s.lastActivity - s.startedAt : 0)
        .filter((d: number) => d > 0 && d < 86400000);
      avgDuration = durations.length > 0 ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0;
    }

    // Top failed queries
    const failedCounts: Record<string, number> = {};
    for (const f of failedData) {
      const q = ((f as any).query || "").toLowerCase().trim();
      if (q) failedCounts[q] = (failedCounts[q] || 0) + 1;
    }
    const topFailed = Object.entries(failedCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([query, count]) => ({ query, count }));

    // Lead sources
    const sourceCounts: Record<string, number> = {};
    for (const l of leadsData) {
      const src = (l as any).source || "widget";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }
    const leadSources = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

    return r({
      eventCounts,
      totalEvents: events.length,
      totalLeads: leadsData.length,
      totalFailed: failedData.length,
      totalSessions: sessionsData.length,
      avgSessionDurationMs: Math.round(avgDuration),
      avgSessionDurationMin: Math.round(avgDuration / 60000 * 10) / 10,
      topFailed,
      leadSources,
    });
  } catch (err: any) {
    return r({ error: err.message }, 500);
  }
}

// POST — log an analytics event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, event, data, timestamp } = body;
    if (!projectId || !event) return r({ error: "projectId and event required" }, 400);

    await addDoc(collection(db(), "analytics_events"), {
      projectId,
      eventType: event,
      data: data || {},
      timestamp: timestamp ? Timestamp.fromMillis(timestamp) : serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    return r({ success: true });
  } catch (err: any) {
    return r({ error: err.message }, 500);
  }
}
