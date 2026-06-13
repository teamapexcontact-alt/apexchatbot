import { useConfigStore } from "../store/configStore";
import { useCallback } from "react";

export function useAnalytics() {
  const { apiUrl, projectId } = useConfigStore();

  const track = useCallback(
    async (event: string, data?: Record<string, any>) => {
      try {
        await fetch(`${apiUrl}/api/analytics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, event, data, timestamp: Date.now() }),
        });
      } catch {}
    },
    [apiUrl, projectId],
  );

  return { track };
}
