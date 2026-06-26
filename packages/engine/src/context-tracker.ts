import { ConversationContext, ConversationAnalysis, Session, FlowDoc } from "./types";

export function createContext(): ConversationContext {
  return {
    currentTopic: null,
    previousTopics: [],
    completedFlowIds: [],
    lastIntent: null,
    lastMatchMethod: null,
    inputCount: 0,
    topics: [],
  };
}

export function setCurrentTopic(ctx: ConversationContext, flow: FlowDoc) {
  if (ctx.currentTopic && ctx.currentTopic !== flow.id) {
    ctx.previousTopics.unshift(ctx.currentTopic);
    if (ctx.previousTopics.length > 10) ctx.previousTopics.pop();
  }
  ctx.currentTopic = flow.id;
  const existing = ctx.topics.find((t) => t.flowId === flow.id);
  if (existing) {
    existing.touchedAt = Date.now();
  } else {
    ctx.topics.push({ flowId: flow.id, flowName: flow.name, touchedAt: Date.now() });
  }
}

export function recordIntent(ctx: ConversationContext, intentName: string, method: string) {
  ctx.lastIntent = intentName;
  ctx.lastMatchMethod = method;
}

export function incrementInput(ctx: ConversationContext) {
  ctx.inputCount++;
}

export function markFlowCompleted(ctx: ConversationContext, flowId: string) {
  if (!ctx.completedFlowIds.includes(flowId)) {
    ctx.completedFlowIds.push(flowId);
  }
}

export function hasCompletedFlow(ctx: ConversationContext, flowId: string): boolean {
  return ctx.completedFlowIds.includes(flowId);
}

export function getLastTopicBefore(ctx: ConversationContext, flowId: string): string | null {
  for (const pt of ctx.previousTopics) {
    if (pt !== flowId) return pt;
  }
  return null;
}

export function analyzeConversation(session: Session): ConversationAnalysis {
  const ctx = session.context || createContext();
  const topicChanges = ctx.previousTopics.length;
  const totalTopics = ctx.topics.length;
  const avgMessagesPerTopic = totalTopics > 0
    ? Math.round(session.history.length / totalTopics)
    : session.history.length;
  const completionRate = ctx.completedFlowIds.length > 0
    ? ctx.completedFlowIds.length / Math.max(1, totalTopics)
    : 0;
  const topicCounts = new Map<string, number>();
  for (const t of ctx.topics) {
    topicCounts.set(t.flowId, (topicCounts.get(t.flowId) || 0) + 1);
  }
  const mostVisitedFlows = [...topicCounts.entries()]
    .map(([flowId, count]) => ({ flowId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const duration = session.startedAt ? Date.now() - session.startedAt : 0;

  return {
    topicChanges,
    avgMessagesPerTopic,
    completionRate,
    mostVisitedFlows,
    collectedData: { ...session.vars },
    duration,
  };
}
