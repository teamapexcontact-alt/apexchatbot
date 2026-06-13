export interface DocumentChunk {
  id: string;
  documentId: string;
  projectId: string;
  content: string;
  index: number;
  createdAt: Date;
}
