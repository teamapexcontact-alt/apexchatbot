"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, getIdTokenResult, User } from "firebase/auth";
import { getAuth$ } from "@/lib/firebase-client";

export interface RoleInfo {
  role: "super_admin" | "client_admin" | "viewer";
  projectIds: string[];
}

export function useRole() {
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth$();
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (u) {
        try {
          const token = await getIdTokenResult(u);
          const claims = token.claims;
          setRoleInfo({
            role: (claims.role as RoleInfo["role"]) || "viewer",
            projectIds: (claims.projectIds as string[]) || [],
          });
        } catch {
          setRoleInfo({ role: "viewer", projectIds: [] });
        }
      } else {
        setRoleInfo(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { roleInfo, loading };
}
