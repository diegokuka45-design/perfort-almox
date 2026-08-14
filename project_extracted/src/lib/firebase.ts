import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "perfort-gerencia.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "perfort-gerencia",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "perfort-gerencia.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "454163899572",
  appId: env.VITE_FIREBASE_APP_ID || "1:454163899572:web:a7b4273464e32946c5a3e1",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-Q45RHRT924"
};

// Safely initialize Firebase App only if a real API key is configured
let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
  try {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
  } catch (e) {
    console.warn("Firebase initialization skipped or failed:", e);
  }
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;

// Initialize Analytics conditionally
export let analytics: Analytics | null = null;

if (typeof window !== 'undefined' && appInstance) {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.apiKey) {
      try {
        analytics = getAnalytics(appInstance!);
      } catch (e) {
        console.warn("Firebase Analytics warning:", e);
      }
    }
  }).catch(() => {});
}


