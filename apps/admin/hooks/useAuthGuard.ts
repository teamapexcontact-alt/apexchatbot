import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { getAuth$ } from "@/lib/firebase-client";
import { useRouter } from "next/navigation";

export function useAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth$();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) router.replace("/login");
    });
    return unsub;
  }, [router]);

  return { user, loading };
}
