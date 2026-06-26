import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { synonymManager } from "@apex/engine";
import { logAudit } from "@/lib/audit-logger";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return r({ error: "projectId required" }, 400);
    const snap = await getDocs(query(collection(db(), "synonyms"), where("projectId", "==", projectId)));
    const dicts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return r(dicts);
  } catch (err: any) { return r({ error: err.message }, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.projectId || !body.word) return r({ error: "projectId and word required" }, 400);
    const ref = await addDoc(collection(db(), "synonyms"), {
      projectId: body.projectId,
      word: body.word.toLowerCase().trim(),
      synonyms: (body.synonyms || []).map((s: string) => s.toLowerCase().trim()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    synonymManager.invalidateCache(body.projectId);
    logAudit({ action: "synonym_updated", resource: "synonym", resourceId: ref.id, projectId: body.projectId, details: `Synonym for "${body.word}" created` });
    return r({ id: ref.id, success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return r({ error: "id required" }, 400);
    await updateDoc(doc(db(), "synonyms", body.id), {
      word: body.word.toLowerCase().trim(),
      synonyms: (body.synonyms || []).map((s: string) => s.toLowerCase().trim()),
      updatedAt: serverTimestamp(),
    });
    synonymManager.invalidateCache(body.projectId);
    logAudit({ action: "synonym_updated", resource: "synonym", resourceId: body.id, projectId: body.projectId, details: `Synonym for "${body.word}" updated` });
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, projectId } = await req.json();
    if (!id) return r({ error: "id required" }, 400);
    await deleteDoc(doc(db(), "synonyms", id));
    if (projectId) synonymManager.invalidateCache(projectId);
    logAudit({ action: "synonym_updated", resource: "synonym", resourceId: id, projectId, details: "Synonym deleted" });
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}
