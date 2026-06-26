import { Session, ConversationContext } from "./types";
import { createContext } from "./context-tracker";

export const SESSION_TTL = 30 * 60 * 1000; // 30 min

export interface SessionStore {
  get(id: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
}

export class SessionManager {
  private store: SessionStore;

  constructor(store: SessionStore) {
    this.store = store;
  }

  async get(sessionId: string): Promise<Session | null> {
    const s = await this.store.get(sessionId);
    if (!s) return null;
    if (Date.now() - s.lastActivity > SESSION_TTL) {
      await this.store.delete(sessionId);
      return null;
    }
    return s;
  }

  async save(s: Session): Promise<void> {
    s.lastActivity = Date.now();
    await this.store.set(s);
  }

  create(sessionId: string, projectId: string): Session {
    return {
      id: sessionId,
      projectId,
      flowId: null,
      stepIndex: 0,
      vars: {},
      history: [],
      startedAt: Date.now(),
      lastActivity: Date.now(),
      completed: false,
      context: createContext(),
    };
  }
}

// ── Vars helper ──
export function applyVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}
