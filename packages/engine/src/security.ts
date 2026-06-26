// ── Rate Limiter ──
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count++;
  // Cleanup stale entries every 100 writes
  if (rateBuckets.size > 10000) {
    const cutoff = now - 60000;
    for (const [k, v] of rateBuckets) {
      if (v.resetAt < cutoff) rateBuckets.delete(k);
    }
  }
  return {
    allowed: bucket.count <= maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// ── Domain Check ──
export function checkDomain(origin: string | null, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  if (!origin) return false;
  try {
    const originHost = new URL(origin).hostname;
    return allowedDomains.some((d) => {
      const pattern = d.replace(/\./g, "\\.").replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`, "i").test(originHost);
    });
  } catch {
    return false;
  }
}

// ── Role Check ──
export type Role = "super_admin" | "client_admin" | "viewer";

export function checkRole(userRole: string | undefined, requiredRole: Role): boolean {
  if (!userRole) return false;
  const hierarchy: Record<Role, number> = { super_admin: 3, client_admin: 2, viewer: 1 };
  const userLevel = hierarchy[userRole as Role] || 0;
  const requiredLevel = hierarchy[requiredRole];
  return userLevel >= requiredLevel;
}

// ── Audit Log ──
export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  projectId?: string;
  details?: string;
  ip?: string;
  timestamp: number;
}

export function createAuditEntry(params: AuditEntry): AuditEntry {
  return { ...params, timestamp: Date.now() };
}
