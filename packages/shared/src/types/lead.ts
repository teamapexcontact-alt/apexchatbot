export interface Lead {
  id: string;
  projectId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  source: string;
  conversationId?: string;
  contacted: boolean;
  createdAt: Date;
}
