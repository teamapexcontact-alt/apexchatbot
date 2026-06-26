import "server-only";
import { getAdminDb$ } from "@/lib/firebase-admin";

export interface AuditParams {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  projectId?: string;
  details?: string;
  ip?: string;
}

export async function logAudit(params: AuditParams) {
  try {
    const db = getAdminDb$();
    if (!db) return;
    await db.collection("audit_logs").add({
      ...params,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
