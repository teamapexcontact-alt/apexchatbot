import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "@apex/config";

function createFirebase() {
  if (typeof window === "undefined") return null;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

let fb: ReturnType<typeof createFirebase> | null = null;

export function getAuth$() {
  if (!fb) fb = createFirebase();
  return fb!.auth;
}

export function getDb$() {
  if (!fb) fb = createFirebase();
  return fb!.db;
}

export function getStorage$() {
  if (!fb) fb = createFirebase();
  return fb!.storage;
}
