import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return r({ error: "projectId required" }, 400);

  const snap = await getDocs(query(collection(db(), "flows"), where("projectId", "==", projectId), where("enabled", "==", true)));
  const flows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return r({ flows });
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, name, triggers, priority, steps } = await req.json();
    if (!projectId || !name) return r({ error: "projectId and name required" }, 400);

    const ref = await addDoc(collection(db(), "flows"), {
      projectId,
      name,
      triggers: triggers || [],
      priority: priority || 0,
      steps: steps || [],
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return r({ id: ref.id, success: true });
  } catch (err: any) {
    return r({ error: err.message }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, name, triggers, priority, steps, enabled } = await req.json();
    if (!id) return r({ error: "id required" }, 400);

    const data: any = { updatedAt: serverTimestamp() };
    if (name !== undefined) data.name = name;
    if (triggers !== undefined) data.triggers = triggers;
    if (priority !== undefined) data.priority = priority;
    if (steps !== undefined) data.steps = steps;
    if (enabled !== undefined) data.enabled = enabled;

    await updateDoc(doc(db(), "flows", id), data);
    return r({ success: true });
  } catch (err: any) {
    return r({ error: err.message }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return r({ error: "id required" }, 400);
    await deleteDoc(doc(db(), "flows", id));
    return r({ success: true });
  } catch (err: any) {
    return r({ error: err.message }, 500);
  }
}
