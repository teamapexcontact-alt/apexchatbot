import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, orderBy, limit, deleteDoc, doc, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { logAudit } from "@/lib/audit-logger";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const max = parseInt(req.nextUrl.searchParams.get("max") || "50");
    if (!projectId) return r({ error: "projectId required" }, 400);
    const snap = await getDocs(query(
      collection(db(), "failed_queries"),
      where("projectId", "==", projectId),
      orderBy("timestamp", "desc"),
      limit(max)
    ));
    return r(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err: any) { return r({ error: err.message }, 500); }
}

export async function POST(req: NextRequest) {
  // Convert a failed query into an FAQ or Flow
  try {
    const { failedQueryId, projectId, type, question, answer, triggers } = await req.json();
    if (!failedQueryId || !projectId) return r({ error: "failedQueryId and projectId required" }, 400);

    const batch = writeBatch(db());

    if (type === "faq") {
      const ref = doc(collection(db(), "faqs"));
      batch.set(ref, {
        projectId, question: question || "", answer: answer || "",
        category: "auto-generated",
        keywords: triggers || [],
        createdAt: serverTimestamp(),
      });
    } else if (type === "flow") {
      const ref = doc(collection(db(), "flows"));
      batch.set(ref, {
        projectId, name: question || "Auto-generated",
        triggers: triggers || [],
        priority: 0, enabled: true,
        steps: [{ type: "message", message: answer || "" }],
        source: "failed_query:" + failedQueryId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Delete the failed query
    batch.delete(doc(db(), "failed_queries", failedQueryId));
    await batch.commit();

    logAudit({ action: "convert_failed_query", resource: "failed_query", resourceId: failedQueryId, projectId, details: `Converted to ${type}: "${question}"` });
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return r({ error: "id required" }, 400);
    await deleteDoc(doc(db(), "failed_queries", id));
    logAudit({ action: "delete_failed_query", resource: "failed_query", resourceId: id, details: "Failed query dismissed" });
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}
