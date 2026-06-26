import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth$, getAdminDb$ } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = getAdminAuth$();
    if (!auth) return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 500 });

    const listResult = await auth.listUsers(1000);
    const users = listResult.users
      .map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        role: u.customClaims?.role || "viewer",
        projectIds: u.customClaims?.projectIds || [],
      }))
      .filter((u) => u.email);

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAdminAuth$();
    const db = getAdminDb$();
    if (!auth || !db) return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 500 });

    const { uid, role, projectIds } = await req.json();
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
    if (!["super_admin", "client_admin", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await auth.setCustomUserClaims(uid, { role, projectIds: projectIds || [] });

    await db.collection("audit_logs").add({
      action: "update_role",
      resource: "user",
      resourceId: uid,
      details: `Role set to ${role}`,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
