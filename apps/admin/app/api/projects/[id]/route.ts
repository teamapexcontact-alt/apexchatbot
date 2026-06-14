import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch, doc, deleteDoc, getDoc } from "firebase/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getServerDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

async function deleteCollection(db: ReturnType<typeof getFirestore>, collectionName: string, projectId: string) {
  const snap = await getDocs(query(collection(db, collectionName), where("projectId", "==", projectId)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(doc(db, collectionName, d.id)));
  await batch.commit();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400, headers: corsHeaders });
    const db = getServerDb();
    const snap = await getDoc(doc(db, "projects", id));
    if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    return NextResponse.json({ projectId: snap.id, ...snap.data() }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Project ID required" }, { status: 400, headers: corsHeaders });

    const db = getServerDb();

    await Promise.all([
      deleteCollection(db, "faqs", id),
      deleteCollection(db, "documents", id),
      deleteCollection(db, "document_chunks", id),
      deleteCollection(db, "leads", id),
      deleteCollection(db, "conversations", id),
      deleteCollection(db, "analytics_events", id),
    ]);

    await deleteDoc(doc(db, "projects", id));

    return NextResponse.json({ success: true, deletedProject: id }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Cascade delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
