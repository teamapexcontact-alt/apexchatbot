export interface AnalyticsEvent {
  id: string;
  projectId: string;
  eventType: AnalyticsEventType;
  sessionId: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export type AnalyticsEventType =
  | "chat_open"
  | "chat_close"
  | "message_sent"
  | "faq_viewed"
  | "lead_submitted"
  | "cta_clicked"
  | "search_performed"
  | "search_failed";
