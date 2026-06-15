import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getCountFromServer, query, where, getDocs } from "firebase/firestore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return r({ error: "projectId required" }, 400);

  try {
    const [flowsSnap, chunksSnap, faqsSnap, docsSnap] = await Promise.all([
      getDocs(query(collection(db(), "flows"), where("projectId", "==", projectId))),
      getDocs(query(collection(db(), "document_chunks"), where("projectId", "==", projectId))),
      getDocs(query(collection(db(), "faqs"), where("projectId", "==", projectId))),
      getDocs(query(collection(db(), "documents"), where("projectId", "==", projectId))),
    ]);

    return r({
      projectId,
      flows: flowsSnap.docs.map((d) => ({ id: d.id, name: d.data().name, triggers: d.data().triggers, enabled: d.data().enabled, source: d.data().source })),
      documentChunks: chunksSnap.size,
      faqs: faqsSnap.docs.map((d) => ({ id: d.id, question: d.data().question })),
      documents: docsSnap.docs.map((d) => ({ id: d.id, fileName: d.data().fileName, textLength: (d.data().content || "").length })),
    });
  } catch (err: any) {
    return r({ error: err.message }, 500);
  }
}
