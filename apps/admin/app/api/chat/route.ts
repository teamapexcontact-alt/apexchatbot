import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
function r(body: any, s = 200) { return NextResponse.json(body, { status: s, headers: CORS }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
function db() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

// ── Levenshtein distance ──
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// ── Intent Matcher ──
interface FlowDoc {
  id: string;
  projectId: string;
  name: string;
  triggers: string[];
  priority: number;
  steps: StepDoc[];
  enabled: boolean;
}

interface StepDoc {
  type: "message" | "buttons" | "collect_input" | "condition" | "transfer" | "end";
  message?: string;
  buttons?: { label: string; action: "next" | "goto_flow"; flowId?: string }[];
  collect?: { key: string; label: string; validation?: "text" | "email" | "phone" | "number" };
  condition?: { variable: string; equals: string; gotoStep?: number; elseStep?: number };
  gotoStep?: number;
}

async function loadFlows(projectId: string): Promise<FlowDoc[]> {
  const snap = await getDocs(query(collection(db(), "flows"), where("projectId", "==", projectId), where("enabled", "==", true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FlowDoc));
}

interface MatchResult { flow: FlowDoc; method: "exact" | "contains" | "fuzzy"; score: number }

function matchIntent(input: string, flows: FlowDoc[]): MatchResult | null {
  const norm = normalize(input);
  const words = norm.split(/\s+/);
  const candidates: MatchResult[] = [];

  for (const flow of flows) {
    if (!flow.triggers || flow.triggers.length === 0) continue;
    for (const trigger of flow.triggers) {
      const tNorm = normalize(trigger);

      // 1. Exact match
      if (norm === tNorm) {
        candidates.push({ flow, method: "exact", score: 0 });
        continue;
      }

      // 2. Contains match
      if (norm.includes(tNorm) || tNorm.includes(norm)) {
        candidates.push({ flow, method: "contains", score: 1 });
        continue;
      }

      // 3. Word-level contains
      const tWords = tNorm.split(/\s+/);
      if (tWords.length <= 3 && tWords.some((tw) => words.includes(tw))) {
        candidates.push({ flow, method: "contains", score: 2 });
        continue;
      }

      // 4. Fuzzy match (Levenshtein on each word)
      for (const w of words) {
        if (w.length < 3) continue;
        for (const tw of tWords) {
          if (tw.length < 3) continue;
          const dist = levenshtein(w, tw);
          const maxLen = Math.max(w.length, tw.length);
          if (dist <= 1 || (dist / maxLen) < 0.3) {
            candidates.push({ flow, method: "fuzzy", score: 3 });
            break;
          }
        }
        if (candidates.length > 0 && candidates[candidates.length - 1].flow.id === flow.id) break;
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score || a.flow.priority - b.flow.priority);
  return candidates[0];
}

// ── Document chunk search (intent matcher, not Fuse) ──
async function matchDocChunks(input: string, projectId: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db(), "document_chunks"), where("projectId", "==", projectId)));
  if (snap.empty) return null;
  const chunks = snap.docs.map((d) => ({ id: d.id, content: d.data().content as string }));

  const norm = normalize(input);
  const words = norm.split(/\s+/).filter((w) => w.length > 2);

  type Candidate = { content: string; overlap: number; fuzzyScore: number };
  const candidates: Candidate[] = [];

  for (const chunk of chunks) {
    const cNorm = normalize(chunk.content);
    const cWords = cNorm.split(/\s+/);

    // Word overlap score
    const overlap = words.filter((w) => cWords.includes(w)).length;

    // Fuzzy score (Levenshtein on significant words)
    let fuzzyScore = 0;
    for (const w of words) {
      for (const cw of cWords) {
        if (cw.length < 3) continue;
        const dist = levenshtein(w, cw);
        const maxLen = Math.max(w.length, cw.length);
        if (dist <= 1 || (dist / maxLen) < 0.3) { fuzzyScore++; break; }
      }
    }

    if (overlap > 0 || fuzzyScore > 0) {
      candidates.push({ content: chunk.content, overlap, fuzzyScore });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by overlap desc, then fuzzyScore desc
  candidates.sort((a, b) => b.overlap - a.overlap || b.fuzzyScore - a.fuzzyScore);
  const best = candidates[0];

  // Require at least 40% word overlap OR at least 1 fuzzy match
  if (best.overlap < Math.ceil(words.length * 0.4) && best.fuzzyScore < 1) return null;

  // Extract context around the matching portion
  let excerpt = best.content.slice(0, 600);
  const matchIdx = normalize(best.content).indexOf(norm.slice(0, 40));
  if (matchIdx > 100) {
    excerpt = "... " + best.content.slice(Math.max(0, matchIdx - 80), matchIdx + 420) + " ...";
  } else if (matchIdx >= 0) {
    excerpt = best.content.slice(Math.max(0, matchIdx - 30), matchIdx + 570);
  }

  return excerpt;
}

// ── FAQ fallback (existing FAQs as simple flows) ──
interface FaqDoc { id: string; question: string; answer: string; category?: string }

async function matchFaq(input: string, projectId: string): Promise<{ answer: string; question: string } | null> {
  const norm = normalize(input);
  const snap = await getDocs(query(collection(db(), "faqs"), where("projectId", "==", projectId)));
  const all: FaqDoc[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FaqDoc));

  // Exact match first
  for (const faq of all) {
    if (normalize(faq.question) === norm) return { answer: faq.answer, question: faq.question };
  }

  // Contains match
  for (const faq of all) {
    const qNorm = normalize(faq.question);
    if (norm.includes(qNorm) || qNorm.includes(norm)) return { answer: faq.answer, question: faq.question };
  }

  // Word overlap
  const words = norm.split(/\s+/).filter((w) => w.length > 2);
  for (const faq of all) {
    const qWords = normalize(faq.question).split(/\s+/).filter((w) => w.length > 2);
    const overlap = words.filter((w) => qWords.includes(w)).length;
    const needed = Math.min(words.length, qWords.length);
    if (words.length > 0 && overlap >= Math.ceil(needed * 0.6)) return { answer: faq.answer, question: faq.question };
  }

  // Fuzzy match on first 3 words of question
  for (const faq of all) {
    const qWords = normalize(faq.question).split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
    const matchCount = words.filter((w) => qWords.some((qw) => levenshtein(w, qw) <= 1 || (Math.max(w.length, qw.length) > 0 && levenshtein(w, qw) / Math.max(w.length, qw.length) < 0.3))).length;
    if (matchCount >= Math.min(2, qWords.length)) return { answer: faq.answer, question: faq.question };
  }

  return null;
}

// ── Session Manager ──
interface Session {
  id: string;
  projectId: string;
  flowId: string | null;
  stepIndex: number;
  vars: Record<string, string>;
  history: { role: "bot" | "user"; message: string; ts: number }[];
  startedAt: number;
  lastActivity: number;
  completed: boolean;
}

const SESSION_TTL = 30 * 60 * 1000; // 30 min

async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const snap = await getDoc(doc(db(), "sessions", sessionId));
    if (!snap.exists()) return null;
    const s = snap.data() as Session;
    if (Date.now() - s.lastActivity > SESSION_TTL) {
      await deleteDoc(doc(db(), "sessions", sessionId));
      return null;
    }
    return s;
  } catch { return null; }
}

async function saveSession(s: Session) {
  try {
    s.lastActivity = Date.now();
    await setDoc(doc(db(), "sessions", s.id), s);
  } catch { /* silent */ }
}

function createSession(sessionId: string, projectId: string): Session {
  return { id: sessionId, projectId, flowId: null, stepIndex: 0, vars: {}, history: [], startedAt: Date.now(), lastActivity: Date.now(), completed: false };
}

// ── Variable System ──
function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

// ── Lead Capture ──
async function captureLead(session: Session, projectId: string) {
  const name = session.vars["user_name"] || session.vars["name"] || "";
  const email = session.vars["user_email"] || session.vars["email"] || "";
  const phone = session.vars["user_phone"] || session.vars["phone"] || "";
  if (!name && !email && !phone) return;
  try {
    await addDoc(collection(db(), "leads"), {
      projectId,
      name, email, phone,
      sessionId: session.id,
      vars: session.vars,
      createdAt: serverTimestamp(),
    });
  } catch { /* silent */ }
}

// ── Flow Executor ──
async function executeFlow(
  flow: FlowDoc,
  session: Session,
  userInput: string
): Promise<{ messages: Array<{ text: string; buttons?: { label: string; action: string; flowId?: string }[]; input?: { key: string; label: string; validation?: string }; transfer?: boolean }>; session: Session; done: boolean; lead?: boolean }> {
  session.flowId = flow.id;
  const messages: any[] = [];
  let done = false;
  let lead = false;

  // Reset to start if not continuing a flow
  if (!session.stepIndex || userInput === "__start") {
    session.stepIndex = 0;
  }

  while (session.stepIndex < flow.steps.length) {
    const step = flow.steps[session.stepIndex];

    switch (step.type) {
      case "message": {
        const text = applyVars(step.message || "", session.vars);
        messages.push({ text });
        session.history.push({ role: "bot", message: text, ts: Date.now() });
        if (step.gotoStep !== undefined) {
          session.stepIndex = step.gotoStep;
        } else {
          session.stepIndex++;
        }
        break;
      }

      case "buttons": {
        const text = applyVars(step.message || "", session.vars);
        const btns = (step.buttons || []).map((b) => ({
          label: b.label,
          action: b.action,
          flowId: b.action === "goto_flow" ? b.flowId : undefined,
        }));
        messages.push({ text, buttons: btns });
        session.history.push({ role: "bot", message: text, ts: Date.now() });
        // Wait for user to click a button — do NOT advance
        done = true;
        break;
      }

      case "collect_input": {
        const text = applyVars(step.message || "", session.vars);
        const inputDef = step.collect;
        messages.push({
          text,
          input: { key: inputDef?.key || "response", label: inputDef?.label || "", validation: inputDef?.validation },
        });
        session.history.push({ role: "bot", message: text, ts: Date.now() });
        // Wait for user to type — do NOT advance yet
        done = true;
        break;
      }

      case "condition": {
        const cond = step.condition!;
        const val = session.vars[cond.variable] || "";
        if (val === cond.equals) {
          session.stepIndex = cond.gotoStep ?? session.stepIndex + 1;
        } else {
          session.stepIndex = cond.elseStep ?? session.stepIndex + 1;
        }
        break;
      }

      case "transfer": {
        const text = applyVars(step.message || "Let me connect you with our team.", session.vars);
        messages.push({ text, transfer: true });
        session.history.push({ role: "bot", message: text, ts: Date.now() });
        lead = true;
        session.completed = true;
        done = true;
        break;
      }

      case "end": {
        const text = applyVars(step.message || "Thank you! Is there anything else I can help with?", session.vars);
        messages.push({ text });
        session.history.push({ role: "bot", message: text, ts: Date.now() });
        lead = true;
        session.completed = true;
        done = true;
        break;
      }
    }

    if (done) break;
  }

  // If flow completed naturally, mark done
  if (session.stepIndex >= flow.steps.length) {
    session.completed = true;
    done = true;
    lead = true;
  }

  return { messages, session, done, lead };
}

// ── Handle collect input response ──
function handleCollectInput(session: Session, input: string, step: StepDoc): string | null {
  const key = step.collect?.key || "response";
  const validation = step.collect?.validation;
  const val = input.trim();

  if (validation === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email address.";
  } else if (validation === "phone") {
    if (!/^[\d\s\+\-\(\)]{7,15}$/.test(val)) return "Please enter a valid phone number.";
  } else if (validation === "number") {
    if (isNaN(Number(val))) return "Please enter a valid number.";
  }

  session.vars[key] = val;
  session.stepIndex++;
  return null;
}

// ── Handle button click ──
function handleButtonClick(session: Session, buttonLabel: string, flow: FlowDoc, allFlows: FlowDoc[]): { newFlow?: FlowDoc; resetStep?: boolean } {
  const step = flow.steps[session.stepIndex];
  if (!step || step.type !== "buttons") return { resetStep: true };

  const btn = (step.buttons || []).find((b) => b.label === buttonLabel);
  if (!btn) return { resetStep: true };

  if (btn.action === "goto_flow" && btn.flowId) {
    const target = allFlows.find((f) => f.id === btn.flowId);
    if (target) {
      session.flowId = target.id;
      session.stepIndex = 0;
      return { newFlow: target };
    }
  }

  // "next" action or unknown — advance to next step
  session.stepIndex++;
  return { resetStep: true };
}

// ── POST /api/chat ──
export async function POST(req: NextRequest) {
  try {
    const { projectId, message, sessionId: sid, buttonLabel } = await req.json();
    if (!projectId || !message) return r({ error: "projectId and message required" }, 400);

    const sessionId = sid || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let s = await getSession(sessionId);
    if (!s) s = createSession(sessionId, projectId);
    s.projectId = projectId;

    // Store user message
    s.history.push({ role: "user", message, ts: Date.now() });

    const allFlows = await loadFlows(projectId);
    let activeFlow = s.flowId ? allFlows.find((f) => f.id === s.flowId) : null;

    // ── Handle button click ──
    if (buttonLabel && activeFlow) {
      const result = handleButtonClick(s, buttonLabel, activeFlow, allFlows);
      if (result.newFlow) activeFlow = result.newFlow;
    }

    // ── Handle collect input response ──
    if (activeFlow && activeFlow.steps[s.stepIndex]?.type === "collect_input") {
      const step = activeFlow.steps[s.stepIndex];
      const err = handleCollectInput(s, message, step);
      if (err) {
        await saveSession(s);
        return r({ type: "error", answer: err, sessionId });
      }
    }

    // ── If no active flow, match intent ──
    if (!activeFlow) {
      const match = matchIntent(message, allFlows);
      if (match) {
        activeFlow = match.flow;
        s.flowId = activeFlow.id;
        s.stepIndex = 0;
      }
    }

    // ── Execute flow ──
    if (activeFlow) {
      const result = await executeFlow(activeFlow, s, message);

      if (result.lead) {
        await captureLead(result.session, projectId);
      }

      await saveSession(result.session);

      if (result.messages.length > 0) {
        const first = result.messages[0];
        return r({
          type: "flow",
          answer: first.text,
          buttons: first.buttons,
          input: first.input,
          transfer: first.transfer,
          sessionId: result.session.id,
          matched: true,
          flowName: activeFlow.name,
          flowId: activeFlow.id,
          done: result.done,
        });
      }
    }

    // ── No flow matched → try document chunks ──
    if (!activeFlow) {
      const chunkAnswer = await matchDocChunks(message, projectId);
      if (chunkAnswer) {
        await saveSession(s);
        return r({
          type: "document",
          answer: chunkAnswer,
          sessionId: s.id,
          matched: true,
        });
      }
    }

    // ── No flow matched → try FAQ fallback ──
    const faq = await matchFaq(message, projectId);
    if (faq) {
      await saveSession(s);
      return r({
        type: "faq",
        answer: faq.answer,
        source: faq.question,
        sessionId: s.id,
        matched: true,
      });
    }

    // ── Fallback ──
    await saveSession(s);

    // Log failed query
    try {
      await addDoc(collection(db(), "failed_queries"), { projectId, query: message, timestamp: serverTimestamp() });
    } catch { /* silent */ }

    const proj = await getDoc(doc(db(), "projects", projectId));
    const pData = proj.data();
    const links: string[] = [];
    if (pData?.whatsappLink) links.push("WhatsApp: " + pData.whatsappLink);
    if (pData?.ctaConfig?.bookCallUrl) links.push("Book a call: " + pData.ctaConfig.bookCallUrl);
    if (pData?.ctaConfig?.viewPricingUrl) links.push("Pricing: " + pData.ctaConfig.viewPricingUrl);

    let fb = "I didn't quite understand that. Here are things I can help you with:";
    if (allFlows.length > 0) {
      const btns = allFlows.slice(0, 5).map((f) => ({ label: f.name, action: "goto_flow", flowId: f.id }));
      return r({ type: "fallback", answer: fb, buttons: btns, sessionId: s.id, matched: false });
    }

    return r({ type: "fallback", answer: fb + "\n" + links.join("\n"), sessionId: s.id, matched: false });
  } catch (err: any) {
    console.error("Chat error:", err);
    return r({ error: err.message }, 500);
  }
}
