export const APEX = {
  version: "1.0.0",
  collections: {
    projects: "projects",
    faqs: "faqs",
    documents: "documents",
    leads: "leads",
    conversations: "conversations",
    analytics: "analytics_events",
  },
  limits: {
    maxUploadSizeMB: 10,
    maxFaqsPerProject: 1000,
    maxMessageLength: 2000,
  },
} as const;
