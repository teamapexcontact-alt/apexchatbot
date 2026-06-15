import { NextRequest, NextResponse } from "next/server";
import { firebaseConfig } from "@apex/config";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, limit, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import Fuse from "fuse.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsResponse(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getServerDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

const STOP_WORDS = new Set([
  "what", "is", "the", "at", "how", "to", "a", "an", "and", "or", "for",
  "of", "in", "on", "with", "my", "i", "do", "does", "can", "will",
  "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "would", "should", "could", "may", "might", "shall", "its", "it's",
  "that", "this", "these", "those", "am", "is", "not", "no", "but",
  "if", "so", "about", "into", "through", "during", "before", "after",
  "above", "below", "than", "then", "also", "just", "very", "too",
]);

const INTENT_KEYWORDS: Record<string, string[]> = {
  pricing: ["price", "cost", "fees", "amount", "paid", "premium", "subscription", "plan", "billing", "charge", "payment", "free trial", "money", "dollar", "rupees", "pricing", "basic", "pro", "enterprise", "upgrade", "downgrade"],
  course: ["course", "class", "lesson", "module", "curriculum", "syllabus", "learn", "study", "training", "program", "workshop", "tutorial", "topic", "content", "material"],
  support: ["support", "help", "issue", "problem", "trouble", "bug", "error", "contact", "reach", "email", "phone", "call", "assist", "stuck", "broken", "not working", "fix"],
  refund: ["refund", "return", "cancel", "money back", "guarantee", "cancellation", "cancel subscription", "cancel plan"],
  enrollment: ["enroll", "register", "signup", "join", "register", "admission", "enrollment", "start", "begin", "getting started", "onboarding"],
  features: ["feature", "capability", "function", "integration", "whatsapp", "slack", "api", "webhook", "analytics", "dashboard", "report"],
  technical: ["technical", "requirement", "browser", "device", "compatible", "system", "install", "setup", "configuration", "configure"],
  community: ["community", "group", "forum", "discord", "telegram", "member", "peer", "network"],
  account: ["account", "password", "login", "sign in", "log in", "profile", "setting", "security", "verify", "verification"],
  timing: ["hours", "timing", "open", "closed", "schedule", "availability", "time", "day", "weekend", "holiday", "business hours"],
  contact: ["contact", "email", "phone", "call", "reach", "address", "location", "office"],
};

const SYNONYMS: Record<string, string[]> = {
  price: ["cost", "fees", "amount", "charge", "pricing", "rate", "value"],
  enroll: ["join", "register", "signup", "admission", "subscribe"],
  duration: ["length", "time", "long", "period", "term"],
  support: ["help", "assist", "aid", "guidance"],
  course: ["class", "program", "training", "workshop", "tutorial"],
  start: ["begin", "kickstart", "initiate", "commence"],
  payment: ["pay", "billing", "charge", "transaction", "checkout"],
  refund: ["return", "cancel", "reversal", "money back"],
  login: ["signin", "sign in", "log in", "access", "authenticate"],
  help: ["support", "assistance", "aid", "guide", "troubleshoot"],
};

function cleanQuery(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function removeStopWords(words: string[]): string[] {
  return words.filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function expandWithSynonyms(words: string[]): string[] {
  const expanded = new Set(words);
  for (const word of words) {
    const syns = SYNONYMS[word];
    if (syns) syns.forEach((s) => expanded.add(s));
    for (const [key, vals] of Object.entries(SYNONYMS)) {
      if (vals.includes(word)) expanded.add(key);
    }
  }
  return Array.from(expanded);
}

function classifyIntent(words: string[]): string | null {
  const scores: Record<string, number> = {};
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const word of words) {
      for (const kw of keywords) {
        if (kw.includes(word) || word.includes(kw)) score++;
      }
    }
    if (score > 0) scores[intent] = score;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

function formatAnswer(type: string, answer: string, source?: string): string {
  const templates: Record<string, string[]> = {
    faq: ["{{answer}}", "{{answer}} Is there anything else I can help with?", "Here's what I know:\n\n{{answer}}", "Great question! {{answer}}", "Sure! {{answer}}"],
    document: ["Based on our documentation:\n\n{{answer}}", "According to our records:\n\n{{answer}}", "Here's what I found:\n\n{{answer}}", "Let me look that up for you:\n\n{{answer}}"],
    order: ["Here are the details:\n\n{{answer}}", "I found your order:\n\n{{answer}}"],
  };
  const tpl = (templates[type] || [])[Math.floor(Math.random() * (templates[type]?.length || 1))] || "{{answer}}";
  return tpl.replace("{{answer}}", answer);
}

async function searchOrders(db: ReturnType<typeof getFirestore>, projectId: string, text: string): Promise<{ answer: string } | null> {
  const m = text.match(/(?:order|track|status)\s*:?\s*[#]?([A-Za-z0-9-]{3,})/i) || text.match(/\b([A-Z0-9]{5,})\b/);
  if (!m) return null;
  const snap = await getDocs(query(collection(db, "orders"), where("projectId", "==", projectId), where("orderId", "==", m[1])));
  if (snap.empty) return null;
  const o = snap.docs[0].data();
  return { answer: `Order #${o.orderId}\nStatus: ${o.status}\nItem: ${o.item || "N/A"}\nAmount: ${o.amount || "N/A"}` };
}

async function logFailedQuery(db: ReturnType<typeof getFirestore>, projectId: string, query: string, intent: string | null) {
  try {
    await addDoc(collection(db, "failed_queries"), {
      projectId,
      query,
      intent,
      timestamp: serverTimestamp(),
    });
  } catch {
    // silent fail
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, message, sessionId } = await req.json();
    if (!projectId || !message) {
      return corsResponse({ error: "projectId and message required" }, 400);
    }

    const db = getServerDb();
    const rawText = message.trim();

    const orderInfo = await searchOrders(db, projectId, rawText);
    if (orderInfo) {
      return corsResponse({ type: "order", answer: formatAnswer("order", orderInfo.answer), matched: true });
    }

    const cleaned = cleanQuery(rawText);
    let words = cleaned.split(/\s+/).filter(Boolean);
    words = removeStopWords(words);
    const expandedWords = expandWithSynonyms(words);
    const intent = classifyIntent(expandedWords);
    const searchText = expandedWords.join(" ");

    const faqSnap = await getDocs(query(collection(db, "faqs"), where("projectId", "==", projectId)));
    const allFaqs = faqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let candidateFaqs = allFaqs;
    if (intent) {
      const filtered = allFaqs.filter((f: any) => f.category === intent);
      if (filtered.length > 0) candidateFaqs = filtered;
    }

    const fuse = new Fuse(candidateFaqs, {
      keys: [
        { name: "question", weight: 0.7 },
        { name: "keywords", weight: 0.3 },
      ],
      threshold: 0.55,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });

    let bestFaq: any = null;
    let bestScore = 1;

    const fuseResults = fuse.search(cleaned);
    if (fuseResults.length > 0) {
      bestFaq = fuseResults[0].item;
      bestScore = fuseResults[0].score ?? 1;
    }

    if (bestFaq && bestScore < 0.4) {
      return corsResponse({
        type: "faq",
        answer: formatAnswer("faq", bestFaq.answer),
        source: bestFaq.question,
        matched: true,
        intent,
        score: bestScore,
      });
    }

    const docSnap = await getDocs(query(collection(db, "document_chunks"), where("projectId", "==", projectId), limit(100)));
    const allDocChunks = docSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (allDocChunks.length > 0 && words.length > 0) {
      const docFuse = new Fuse(allDocChunks, {
        keys: ["content"],
        threshold: 0.35,
        includeScore: true,
        minMatchCharLength: 2,
        ignoreLocation: true,
      });
      const docResults = docFuse.search(searchText + " " + cleaned);
      if (docResults.length > 0 && (docResults[0].score ?? 1) < 0.35) {
        const chunk = docResults[0].item as any;
        let excerpt = chunk.content.slice(0, 600);
        const matchIdx = chunk.content.toLowerCase().indexOf(cleaned.slice(0, 30));
        if (matchIdx > 100) excerpt = "... " + chunk.content.slice(Math.max(0, matchIdx - 80), matchIdx + 420) + " ...";
        return corsResponse({
          type: "document",
          answer: formatAnswer("document", excerpt),
          source: chunk.fileName || "Document",
          matched: true,
          score: docResults[0].score,
          intent,
        });
      }
    }

    await logFailedQuery(db, projectId, rawText, intent);

    const projSnap = await getDoc(doc(db, "projects", projectId));
    const project = projSnap.data();
    const contactLinks: string[] = [];
    if (project?.whatsappLink) contactLinks.push(project.whatsappLink);
    if (project?.ctaConfig?.bookCallUrl) contactLinks.push(project.ctaConfig.bookCallUrl);
    if (project?.ctaConfig?.viewPricingUrl) contactLinks.push(project.ctaConfig.viewPricingUrl);

    let fbAnswer = "I'm not completely sure about that. Please ask another question or contact our team for assistance.";
    if (contactLinks.length > 0) {
      fbAnswer = "I'm not completely sure about that.\n\n" + contactLinks.map((l) => (l.includes("whatsapp") ? "WhatsApp: " : l.includes("book") ? "Book a call: " : "Pricing: ") + l).join("\n") + "\n\nFeel free to ask something else!";
    }

    return corsResponse({
      type: "fallback",
      answer: fbAnswer,
      matched: false,
      intent,
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return corsResponse({ error: err.message }, 500);
  }
}
