import type { FAQ } from "@apex/shared";

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
  pricing: ["price", "cost", "fees", "amount", "paid", "premium", "subscription", "plan", "billing", "charge", "payment", "free trial", "money", "dollar", "rupees", "pricing", "basic", "pro", "enterprise", "upgrade"],
  course: ["course", "class", "lesson", "module", "curriculum", "syllabus", "learn", "study", "training", "program"],
  support: ["support", "help", "issue", "problem", "trouble", "bug", "error", "contact", "assist", "stuck", "broken", "not working", "fix"],
  refund: ["refund", "return", "cancel", "money back", "guarantee", "cancellation"],
  enrollment: ["enroll", "register", "signup", "join", "admission", "start", "begin", "onboarding"],
  features: ["feature", "capability", "integration", "whatsapp", "slack", "api", "analytics", "dashboard"],
  technical: ["technical", "requirement", "browser", "install", "setup", "configuration"],
  community: ["community", "group", "forum", "discord", "telegram", "member"],
  account: ["account", "password", "login", "sign in", "profile", "setting", "security", "verify"],
  timing: ["hours", "timing", "open", "closed", "schedule", "availability", "time", "weekend", "business hours"],
  contact: ["contact", "email", "phone", "call", "reach", "address", "location"],
};

const SYNONYMS: Record<string, string[]> = {
  price: ["cost", "fees", "amount", "charge", "pricing", "rate"],
  enroll: ["join", "register", "signup", "admission", "subscribe"],
  duration: ["length", "time", "long", "period"],
  support: ["help", "assist", "aid"],
  course: ["class", "program", "training", "workshop"],
  start: ["begin", "kickstart"],
  payment: ["pay", "billing", "charge", "transaction"],
  refund: ["return", "cancel", "reversal"],
  login: ["signin", "sign in", "log in", "access"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
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

export interface SearchResult {
  faq: FAQ;
  score: number;
}

export function searchFaqs(faqs: FAQ[], query: string): SearchResult[] {
  const cleaned = normalize(query);
  let words = cleaned.split(/\s+/).filter(Boolean);
  words = words.filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length === 0) return [];

  const expandedWords = expandWithSynonyms(words);
  const intent = classifyIntent(expandedWords);

  let candidates = faqs;
  if (intent) {
    const filtered = faqs.filter((f) => f.category === intent);
    if (filtered.length > 0) candidates = filtered;
  }

  const searchTerms = [...new Set([...words, ...expandedWords])];
  const results: SearchResult[] = [];

  for (const faq of candidates) {
    const qWords = normalize(faq.question).split(/\s+/).filter((w) => w.length > 2);
    const kwWords = (faq.keywords ?? []).flatMap((k) => normalize(k).split(/\s+/)).filter((w) => w.length > 2);
    const allTargets = [...new Set([...qWords, ...kwWords])];

    let matchCount = 0;
    for (const st of searchTerms) {
      if (allTargets.some((t) => t.includes(st) || st.includes(t))) matchCount++;
    }

    const ratio = matchCount / Math.max(searchTerms.length, 1);
    if (ratio >= 0.3) {
      results.push({ faq, score: ratio });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}
