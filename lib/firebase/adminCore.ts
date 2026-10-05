import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Server Firebase with the service account. Imported by lib/firebase/admin.ts (routes)
 * and directly by scripts/. Never import this from a client component.
 */
function app(): App {
  if (getApps().length) return getApp();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel and .env files store the key with literal \n sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    // Carries a code so the route wrapper logs it and shows users a generic error.
    throw Object.assign(new Error("FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be set on the server."), { code: "config/missing-env" });
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
export const adminBucket = () => getStorage(app()).bucket();
