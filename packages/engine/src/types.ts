// ── Core Types ──

export interface FlowDoc {
  id: string;
  projectId: string;
  name: string;
  triggers: string[];
  priority: number;
  steps: StepDoc[];
  enabled: boolean;
  category?: string;
  tags?: string[];
}

export interface StepDoc {
  type: "message" | "buttons" | "collect_input" | "condition" | "transfer" | "end"
    | "api_call" | "webhook" | "email" | "delay" | "db_query"
    | "whatsapp" | "payment" | "notification" | "custom_function";
  message?: string;
  buttons?: { label: string; action: "next" | "goto_flow"; flowId?: string }[];
  collect?: { key: string; label: string; validation?: "text" | "email" | "phone" | "number" };
  condition?: { variable: string; equals: string; gotoStep?: number; elseStep?: number };
  gotoStep?: number;
  // New step type configs
  apiCall?: { url: string; method: "GET" | "POST"; headers?: Record<string,string>; body?: string; mapResponse?: string; responseVar?: string };
  webhook?: { url: string; method: string; headers?: Record<string,string>; payload?: string; responseVar?: string };
  email?: { to: string; subject: string; body: string; cc?: string };
  delay?: { seconds: number };
  dbQuery?: { query: string; params?: string[]; responseVar?: string };
  whatsapp?: { templateName: string; to: string; params?: string[] };
  payment?: { amount: number; currency: string; description: string; responseVar?: string };
  notification?: { type: "email" | "sms" | "push"; to: string; title?: string; body: string };
  customFn?: { functionName: string; params?: Record<string,string>; responseVar?: string };
}

export interface Session {
  id: string;
  projectId: string;
  flowId: string | null;
  stepIndex: number;
  vars: Record<string, string>;
  history: { role: "bot" | "user"; message: string; ts: number }[];
  startedAt: number;
  lastActivity: number;
  completed: boolean;
  context?: ConversationContext;
}

export interface ConversationContext {
  currentTopic: string | null;
  previousTopics: string[];
  completedFlowIds: string[];
  lastIntent: string | null;
  lastMatchMethod: string | null;
  inputCount: number;
  topics: { flowId: string; flowName: string; touchedAt: number }[];
}

export interface MatchResult {
  flow: FlowDoc;
  score: number;
  method: string;
  details: {
    matchedTrigger: string;
    synonymMatch?: string;
    wordOverlap: number;
    fuzzyDistance?: number;
    expandedInput?: string;
  };
}

export interface ScoringConfig {
  exactWeight: number;
  containsWeight: number;
  synonymWeight: number;
  wordOverlapWeight: number;
  fuzzyWeight: number;
  wordOverlapThreshold: number;
  fuzzyDistanceRatio: number;
  minWordLength: number;
  stopWords: string[];
}

export interface SynonymDict {
  id?: string;
  projectId: string;
  word: string;
  synonyms: string[];
}

export interface KnowledgeRecord {
  id: string;
  projectId: string;
  type: "faq" | "section" | "heading" | "list_item" | "table_cell" | "description";
  question?: string;
  answer: string;
  category?: string;
  keywords: string[];
  source: string;
  section?: string;
  heading?: string;
  order: number;
}

export interface ExecuteResult {
  messages: Array<{
    text: string;
    buttons?: { label: string; action: string; flowId?: string }[];
    input?: { key: string; label: string; validation?: string };
    transfer?: boolean;
  }>;
  session: Session;
  done: boolean;
  lead: boolean;
}

export interface ConversationAnalysis {
  topicChanges: number;
  avgMessagesPerTopic: number;
  completionRate: number;
  mostVisitedFlows: { flowId: string; count: number }[];
  collectedData: Record<string, string>;
  duration: number;
}
