import { SynonymDict } from "./types";

export class SynonymManager {
  private cache: Map<string, Map<string, string[]>> = new Map();
  private loaders: Map<string, () => Promise<SynonymDict[]>> = new Map();

  registerLoader(projectId: string, loader: () => Promise<SynonymDict[]>) {
    this.loaders.set(projectId, loader);
  }

  async loadForProject(projectId: string): Promise<Map<string, string[]>> {
    if (this.cache.has(projectId)) {
      return this.cache.get(projectId)!;
    }

    const map = new Map<string, string[]>();

    // Load project-specific synonyms
    const loader = this.loaders.get(projectId);
    if (loader) {
      const dicts = await loader();
      for (const d of dicts) {
        const key = d.word.toLowerCase().trim();
        const syns = d.synonyms.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 0);
        if (key && syns.length > 0) {
          map.set(key, syns);
          // Also register reverse: each synonym -> word
          for (const s of syns) {
            const existing = map.get(s) || [];
            if (!existing.includes(key)) {
              map.set(s, [...existing, key]);
            }
          }
        }
      }
    }

    // Built-in industry synonyms (default)
    const builtin: Record<string, string[]> = {
      "admission": ["enroll", "enrollment", "join", "register", "registration", "apply", "application"],
      "price": ["pricing", "cost", "fee", "fees", "charges", "rate", "rates", "payment", "plan"],
      "service": ["services", "offering", "offerings", "product", "products", "solution", "solutions"],
      "contact": ["reach", "call", "phone", "email", "message", "support", "help"],
      "hours": ["timing", "time", "schedule", "opening", "business hours", "working hours"],
      "location": ["address", "directions", "place", "branch", "office", "store"],
      "refund": ["return", "cancellation", "cancel", "money back", "reimbursement"],
      "shipping": ["delivery", "shipment", "dispatch", "track", "tracking", "courier"],
      "login": ["signin", "sign in", "log in", "sign in", "access", "account"],
      "password": ["pass", "pwd", "forgot password", "reset password", "change password"],
      "discount": ["offer", "promo", "promotion", "coupon", "deal", "sale", "special"],
      "appointment": ["booking", "book", "reservation", "schedule", "meeting", "slot"],
      "complaint": ["issue", "problem", "concern", "grievance", "feedback", "complaint"],
    };

    for (const [word, syns] of Object.entries(builtin)) {
      if (!map.has(word)) {
        map.set(word, syns);
        for (const s of syns) {
          const existing = map.get(s) || [];
          if (!existing.includes(word)) {
            map.set(s, [...existing, word]);
          }
        }
      }
    }

    this.cache.set(projectId, map);
    return map;
  }

  invalidateCache(projectId?: string) {
    if (projectId) {
      this.cache.delete(projectId);
    } else {
      this.cache.clear();
    }
  }
}

export const synonymManager = new SynonymManager();
