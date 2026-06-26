export { IntentMatcher } from "./intent-matcher";
export { synonymManager, SynonymManager } from "./synonym-dict";
export { createContext, analyzeConversation, setCurrentTopic, recordIntent, incrementInput, markFlowCompleted, hasCompletedFlow } from "./context-tracker";
export { KnowledgeRetriever } from "./knowledge-retriever";
export { SessionManager, SESSION_TTL, applyVars } from "./session-manager";
export type { SessionStore } from "./session-manager";
export { executeFlow, handleCollectInput, handleButtonClick, captureLead } from "./workflow-executor";
export { normalize, levenshtein, simpleStem, preprocess, DEFAULT_STOP_WORDS, DEFAULT_SCORING_CONFIG } from "./nlp";
export type * from "./types";

import { IntentMatcher } from "./intent-matcher";
import { synonymManager } from "./synonym-dict";
import { KnowledgeRetriever } from "./knowledge-retriever";
import { SessionManager, SessionStore } from "./session-manager";
import { createContext, recordIntent, incrementInput } from "./context-tracker";
import { executeFlow, handleCollectInput, handleButtonClick, captureLead } from "./workflow-executor";
import { FlowDoc, Session, ScoringConfig, ConversationContext } from "./types";

export interface EngineOptions {
  scoringConfig?: Partial<ScoringConfig>;
  sessionStore: SessionStore;
  loadSynonyms: (projectId: string) => Promise<void>;
  execDeps?: {
    httpFetch?: (url: string, opts: any) => Promise<any>;
    sendEmail?: (opts: any) => Promise<any>;
    dbQuery?: (query: string, params?: string[]) => Promise<any[]>;
    sendWhatsApp?: (opts: any) => Promise<any>;
    processPayment?: (opts: any) => Promise<any>;
    sendNotification?: (opts: any) => Promise<any>;
  };
}

export class ConversationEngine {
  public intentMatcher: IntentMatcher;
  public knowledgeRetriever: KnowledgeRetriever;
  public sessionManager: SessionManager;
  public execDeps: EngineOptions["execDeps"];

  constructor(opts: EngineOptions) {
    this.intentMatcher = new IntentMatcher(opts.scoringConfig);
    this.knowledgeRetriever = new KnowledgeRetriever(opts.scoringConfig);
    this.sessionManager = new SessionManager(opts.sessionStore);
    this.execDeps = opts.execDeps;
  }

  async processMessage(
    projectId: string,
    message: string,
    sessionId?: string,
    buttonLabel?: string,
    flows: FlowDoc[] = []
  ): Promise<{
    type: "flow" | "document" | "faq" | "fallback" | "error";
    answer?: string;
    buttons?: any[];
    input?: any;
    transfer?: boolean;
    flowName?: string;
    sessionId: string;
    matched: boolean;
    score?: number;
    method?: string;
  }> {
    const sid = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let s = await this.sessionManager.get(sid);
    if (!s) s = this.sessionManager.create(sid, projectId);
    s.projectId = projectId;

    // Load synonyms for this project
    await synonymManager.loadForProject(projectId);

    // Store user message
    s.history.push({ role: "user", message, ts: Date.now() });

    const allFlows = flows.filter((f) => f.enabled !== false);
    let activeFlow = s.flowId ? allFlows.find((f) => f.id === s.flowId) : null;

    // Handle button click
    if (buttonLabel && activeFlow) {
      const result = handleButtonClick(s, buttonLabel, activeFlow, allFlows);
      if (result.newFlow) activeFlow = result.newFlow;
    }

    // Handle collect input response
    if (activeFlow && activeFlow.steps[s.stepIndex]?.type === "collect_input") {
      const step = activeFlow.steps[s.stepIndex];
      const err = handleCollectInput(s, message, step);
      if (err) {
        await this.sessionManager.save(s);
        return { type: "error", answer: err, sessionId: sid, matched: false };
      }
    }

    // Match intent if no active flow
    if (!activeFlow) {
      const match = this.intentMatcher.match(message, allFlows);
      if (match) {
        activeFlow = match.flow;
        s.flowId = activeFlow.id;
        s.stepIndex = 0;
        if (s.context) {
          recordIntent(s.context, activeFlow.name, match.method);
        }

        // Return early with intent info
        const result = await executeFlow(activeFlow, s, message, this.execDeps);
        if (result.lead) {
          await captureLead(s, projectId, async (data) => {});
        }
        await this.sessionManager.save(s);
        await this.sessionManager.save(s);

        if (result.messages.length > 0) {
          const first = result.messages[0];
          return {
            type: "flow",
            answer: first.text,
            buttons: first.buttons,
            input: first.input,
            transfer: first.transfer,
            sessionId: result.session.id,
            matched: true,
            score: match.score,
            method: match.method,
          };
        }
      }
    }

    // Execute flow if active
    if (activeFlow) {
      const result = await executeFlow(activeFlow, s, message, this.execDeps);
      if (result.lead) {
        await captureLead(s, projectId, async (data) => {});
      }
      await this.sessionManager.save(s);

      if (result.messages.length > 0) {
        const first = result.messages[0];
        return {
          type: "flow",
          answer: first.text,
          buttons: first.buttons,
          input: first.input,
          transfer: first.transfer,
          sessionId: result.session.id,
          matched: true,
          flowName: activeFlow.name,
        };
      }
    }

    // Fallback
    await this.sessionManager.save(s);
    return {
      type: "fallback",
      matched: false,
      sessionId: sid,
    };
  }
}
