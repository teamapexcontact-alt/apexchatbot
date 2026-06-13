import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client";
import { useConfigStore } from "../store/configStore";
import type { AnalyticsEventType } from "@apex/shared";

let sessionId: string;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return sessionId;
}

export function useAnalytics() {
  const projectId = useConfigStore((s) => s.project?.projectId ?? "default");

  const track = async (eventType: AnalyticsEventType, metadata?: Record<string, unknown>) => {
    try {
      await addDoc(collection(db, "analytics_events"), {
        projectId,
        eventType,
        sessionId: getSessionId(),
        metadata: metadata ?? {},
        timestamp: serverTimestamp(),
      });
    } catch {
      // silently fail
    }
  };

  return { track };
}
