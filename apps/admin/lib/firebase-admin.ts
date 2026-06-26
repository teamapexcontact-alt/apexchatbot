import "server-only";

import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

function getAdmin() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) return null;

  try {
    const app =
      getAdminApps().length === 0
        ? initializeAdminApp({
            credential: cert(JSON.parse(key)),
          })
        : getAdminApps()[0];

    return {
      auth: getAdminAuth(app),
      db: getAdminFirestore(app),
    };
  } catch (err) {
    console.error("Firebase Admin init error:", err);
    return null;
  }
}

let admin: ReturnType<typeof getAdmin> | null = null;

export function getAdminAuth$() {
  if (!admin) admin = getAdmin();
  return admin?.auth || null;
}

export function getAdminDb$() {
  if (!admin) admin = getAdmin();
  return admin?.db || null;
}
