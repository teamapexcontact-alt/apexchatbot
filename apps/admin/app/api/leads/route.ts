import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, orderBy, limit } from "firebase/firestore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

const PIPELINE_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;

// ── POST Create lead ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, name, email, phone, company, source, sessionId, vars, context } = body;
    if (!projectId || !name || !email || !phone) return r({ error: "projectId, name, email, phone required" }, 400);

    // Auto-generate tags from conversation context
    const tags: string[] = [];
    if (context?.completedFlowIds) {
      tags.push(...context.completedFlowIds.map((f: string) => `flow:${f.slice(0, 8)}`));
    }
    if (context?.topics) {
      tags.push(...context.topics.map((t: any) => `topic:${t.flowName?.slice(0, 20)}`));
    }
    if (vars?.user_name) tags.push("collected_name");
    if (vars?.user_email) tags.push("collected_email");
    if (vars?.user_phone) tags.push("collected_phone");

    await addDoc(collection(db(), "leads"), {
      projectId, name, email, phone,
      company: company || "", source: source || "widget",
      sessionId: sessionId || "", vars: vars || {},
      pipelineStage: "new",
      tags: [...new Set(tags)],
      notes: [],
      followUps: [],
      contacted: false, contactedAt: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}

// ── GET /api/leads?projectId=xxx&stage=xxx&max=50 ──
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const stage = req.nextUrl.searchParams.get("stage");
    const max = parseInt(req.nextUrl.searchParams.get("max") || "100");
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    const constraints: any[] = [];
    if (projectId) constraints.push(where("projectId", "==", projectId));
    if (stage) constraints.push(where("pipelineStage", "==", stage));
    if (sessionId) constraints.push(where("sessionId", "==", sessionId));
    constraints.push(orderBy("createdAt", "desc"), limit(max));

    const snap = await getDocs(query(collection(db(), "leads"), ...constraints));
    return r(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err: any) { return r({ error: err.message }, 500); }
}

// ── PUT /api/leads (update stage, tags, notes, followUps) ──
export async function PUT(req: NextRequest) {
  try {
    const { id, pipelineStage, tags, note, followUp, contacted } = await req.json();
    if (!id) return r({ error: "id required" }, 400);
    const ref = doc(db(), "leads", id);
    const update: any = { updatedAt: serverTimestamp() };

    if (pipelineStage && PIPELINE_STAGES.includes(pipelineStage)) update.pipelineStage = pipelineStage;
    if (tags !== undefined) update.tags = tags;
    if (contacted !== undefined) { update.contacted = contacted; update.contactedAt = contacted ? serverTimestamp() : null; }

    // Add note
    if (note) {
      const existing = (await getDoc(ref)).data()?.notes || [];
      update.notes = [...existing, { text: note, createdAt: new Date().toISOString() }];
    }

    // Add follow-up
    if (followUp) {
      const existing = (await getDoc(ref)).data()?.followUps || [];
      update.followUps = [...existing, { ...followUp, done: false, createdAt: new Date().toISOString() }];
    }

    await updateDoc(ref, update);
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}

// ── DELETE /api/leads ──
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return r({ error: "id required" }, 400);
    await deleteDoc(doc(db(), "leads", id));
    return r({ success: true });
  } catch (err: any) { return r({ error: err.message }, 500); }
}
