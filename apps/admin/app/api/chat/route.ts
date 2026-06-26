import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import {
  ConversationEngine, SessionStore, Session,
  normalize, levenshtein,
  KnowledgeRetriever,
  synonymManager,
  checkRateLimit,
  checkDomain,
} from "@apex/engine";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

// ── Firestore Session Store ──
const sessionStore: SessionStore = {
  async get(id: string) {
    try {
      const snap = await getDoc(doc(db(), "sessions", id));
      if (!snap.exists()) return null;
      const s = snap.data() as Session;
      if (Date.now() - s.lastActivity > 30 * 60 * 1000) {
        await deleteDoc(doc(db(), "sessions", id));
        return null;
      }
      return s;
    } catch { return null; }
  },
  async set(session: Session) {
    try {
      session.lastActivity = Date.now();
      await setDoc(doc(db(), "sessions", session.id), session);
    } catch { /* silent */ }
  },
  async delete(id: string) {
    try { await deleteDoc(doc(db(), "sessions", id)); } catch { /* silent */ }
  },
};

// ── Engine instance (singleton-ish) ──
const engine = new ConversationEngine({
  sessionStore,
  loadSynonyms: async (projectId: string) => {
    await synonymManager.loadForProject(projectId);
  },
});

// ── Knowledge Retriever for doc chunks + FAQ fallback ──
const knowledgeRetriever = new KnowledgeRetriever();

// ── Firestore helpers ──
async function loadFlows(projectId: string) {
  const snap = await getDocs(query(
    collection(db(), "flows"),
    where("projectId", "==", projectId),
    where("enabled", "==", true)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
}

async function matchDocChunks(input: string, projectId: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db(), "document_chunks"), where("projectId", "==", projectId)));
  if (snap.empty) return null;

  const records = snap.docs.map((d) => ({
    id: d.id,
    projectId,
    type: "section" as const,
    answer: d.data().content as string,
    keywords: [],
    source: "document_chunks",
    order: d.data().index || 0,
  }));

  const match = knowledgeRetriever.search(input, records);
  if (!match) return null;

  const best = match.record.answer;
  // Return excerpt around match point
  const norm = normalize(input);
  let excerpt = best.slice(0, 600);
  const matchIdx = normalize(best).indexOf(norm.slice(0, 40));
  if (matchIdx > 100) {
    excerpt = "... " + best.slice(Math.max(0, matchIdx - 80), matchIdx + 420) + " ...";
  } else if (matchIdx >= 0) {
    excerpt = best.slice(Math.max(0, matchIdx - 30), matchIdx + 570);
  }
  return excerpt;
}

async function matchFaq(input: string, projectId: string): Promise<{ answer: string; question: string } | null> {
  const snap = await getDocs(query(collection(db(), "faqs"), where("projectId", "==", projectId)));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  const records = all.map((faq: any) => ({
    id: faq.id, projectId,
    type: "faq" as const,
    question: faq.question,
    answer: faq.answer,
    keywords: faq.keywords || [],
    category: faq.category,
    source: "faq",
    order: 0,
  }));

  const match = knowledgeRetriever.search(input, records);
  if (match && match.record.question) {
    return { answer: match.record.answer, question: match.record.question };
  }
  return null;
}

// ── POST /api/chat ──
export async function POST(req: NextRequest) {
  try {
    const { projectId, message, sessionId: sid, buttonLabel } = await req.json();
    if (!projectId || !message) return r({ error: "projectId and message required" }, 400);

    // ── Domain restriction check ──
    const projDoc = await getDoc(doc(db(), "projects", projectId));
    const pData = projDoc.data();
    const allowedDomains: string[] = pData?.allowedDomains || [];
    if (allowedDomains.length > 0) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      if (!checkDomain(origin, allowedDomains)) {
        return r({ error: "Domain not allowed" }, 403);
      }
    }

    // ── Rate limiting (per project) ──
    const rl = checkRateLimit(`chat:${projectId}`, 100, 60000);
    if (!rl.allowed) {
      return r({ error: "Rate limit exceeded. Try again later." }, 429);
    }

    // ── Use ConversationEngine for flow matching & execution ──
    const allFlows = await loadFlows(projectId);
    const result = await engine.processMessage(projectId, message, sid, buttonLabel, allFlows);

    // Return early if flow matched
    if (result.type === "flow" || result.type === "error") {
      return r(result);
    }

    // ── No flow matched → try document chunks ──
    const chunkAnswer = await matchDocChunks(message, projectId);
    if (chunkAnswer) {
      // Update session
      const targetSid = result.sessionId;
      const s = await sessionStore.get(targetSid);
      if (s) { await sessionStore.set(s); }
      return r({ type: "document", answer: chunkAnswer, sessionId: targetSid, matched: true });
    }

    // ── No flow/doc chunk → try FAQ fallback ──
    const faq = await matchFaq(message, projectId);
    if (faq) {
      const targetSid = result.sessionId;
      const s = await sessionStore.get(targetSid);
      if (s) { await sessionStore.set(s); }
      return r({ type: "faq", answer: faq.answer, source: faq.question, sessionId: targetSid, matched: true });
    }

    // ── Fallback ──
    const targetSid = result.sessionId;
    const s = await sessionStore.get(targetSid);
    if (s) { await sessionStore.set(s); }

    // Log failed query
    try {
      await addDoc(collection(db(), "failed_queries"), {
        projectId, query: message,
        timestamp: serverTimestamp(),
        sessionId: targetSid,
        context: s?.context || null,
      });
    } catch { /* silent */ }

    const links: string[] = [];
    if (pData?.whatsappLink) links.push("WhatsApp: " + pData.whatsappLink);
    if (pData?.ctaConfig?.bookCallUrl) links.push("Book a call: " + pData.ctaConfig.bookCallUrl);
    if (pData?.ctaConfig?.viewPricingUrl) links.push("Pricing: " + pData.ctaConfig.viewPricingUrl);

    let fb = "I didn't quite understand that. Here are things I can help you with:";
    if (allFlows.length > 0) {
      const btns = allFlows.slice(0, 5).map((f: any) => ({
        label: f.name,
        action: "goto_flow",
        flowId: f.id,
      }));
      return r({ type: "fallback", answer: fb, buttons: btns, sessionId: targetSid, matched: false });
    }

    return r({
      type: "fallback",
      answer: fb + "\n" + links.join("\n"),
      sessionId: targetSid,
      matched: false,
    });
  } catch (err: any) {
    console.error("Chat error:", err);
    return r({ error: err.message }, 500);
  }
}
