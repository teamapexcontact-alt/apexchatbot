import { NextRequest, NextResponse } from "next/server";
import { getAdminDb$ } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb$();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 500 });

    const action = req.nextUrl.searchParams.get("action") || "";
    const projectId = req.nextUrl.searchParams.get("projectId") || "";

    let q: any = db.collection("audit_logs").orderBy("timestamp", "desc").limit(100);
    if (action) q = db.collection("audit_logs").where("action", "==", action).orderBy("timestamp", "desc").limit(100);

    const snap = await q.get();
    const logs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
