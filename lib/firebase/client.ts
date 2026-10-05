import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Browser Firebase. Created lazily so mock mode never needs Firebase env vars.
 * These values are public by design; Firestore and Storage rules are what protect the data.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function app(): FirebaseApp {
  if (getApps().length) return getApp();
  if (!config.apiKey || !config.projectId || !config.authDomain || !config.storageBucket) {
    throw new Error(
      "Firebase is selected but NEXT_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID and _STORAGE_BUCKET are not all set.",
    );
  }
  return initializeApp(config);
}

export const fbAuth = (): Auth => getAuth(app());
export const fbDb = (): Firestore => getFirestore(app());
export const fbStorage = (): FirebaseStorage => getStorage(app());
