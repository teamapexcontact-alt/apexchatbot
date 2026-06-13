export interface FAQ {
  id: string;
  projectId: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  createdAt: Date;
}
