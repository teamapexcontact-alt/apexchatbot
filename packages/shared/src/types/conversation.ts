export interface Conversation {
  id: string;
  projectId: string;
  sessionId: string;
  visitorId: string;
  messages: Message[];
  leadId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  role: "user" | "bot" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
