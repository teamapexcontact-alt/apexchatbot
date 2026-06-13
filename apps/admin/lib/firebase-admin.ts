import "server-only";

import {
  initializeApp as initializeAdminApp,
  getApps as getAdminApps,
  cert,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

const adminApp =
  getAdminApps().length === 0
    ? initializeAdminApp({
        credential: cert(
          process.env.FIREBASE_SERVICE_ACCOUNT_KEY
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
            : {}
        ),
      })
    : getAdminApps()[0];

export const adminAuth = getAdminAuth(adminApp);
export const adminDb = getAdminFirestore(adminApp);
