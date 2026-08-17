// ============================================================================
// Firebase SDK Initialization — PerfortAlmox
// ============================================================================
// Reads config from VITE_ prefixed env vars (Vite convention).
// Falls back to placeholder strings so the app compiles even without .env.
// When no real config is provided, Firestore calls will gracefully degrade
// to localStorage (handled in firestoreStorage.ts).
// ============================================================================

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

// ---------- Config ----------
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY           || '',
  authDomain:       import.meta.env.VITE_FIREBASE_AUTH_DOMAIN       || '',
  databaseURL:      import.meta.env.VITE_FIREBASE_DATABASE_URL      || '',
  projectId:        import.meta.env.VITE_FIREBASE_PROJECT_ID        || '',
  storageBucket:    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET    || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:            import.meta.env.VITE_FIREBASE_APP_ID           || '',
  measurementId:    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID   || '',
};

// ---------- Detect real config ----------
const hasRealConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// ---------- Initialize (only if config present) ----------
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;

if (hasRealConfig) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    rtdb = getDatabase(app);
    auth = getAuth(app);
    console.log('[Firebase] Initialized — project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Initialization failed, falling back to localStorage:', err);
    app = null;
    db = null;
    rtdb = null;
    auth = null;
  }
} else {
  console.info('[Firebase] No VITE_FIREBASE_* config found — running in localStorage-only mode.');
}

// ---------- Exports ----------
export { app, db, rtdb, auth, hasRealConfig };
