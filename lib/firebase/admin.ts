import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let db: Firestore | null = null;

export function firebaseAdminConfigured() {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

/**
 * Accepts the private key however it was pasted: with or without wrapping quotes, with a
 * trailing comma from the JSON file, with literal \n sequences or real line breaks, and with
 * Windows line endings.
 */
export function normalizePrivateKey(raw: string): string {
  let k = raw.trim();
  if (k.endsWith(",")) k = k.slice(0, -1).trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  k = k.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  if (!k.includes("-----BEGIN PRIVATE KEY-----") || !k.includes("-----END PRIVATE KEY-----")) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY looks incomplete. Paste the whole private_key value from the service account JSON, from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----\\n, on one line in double quotes.",
    );
  }
  return `${k}\n`;
}

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApp();
    return app;
  }
  if (!firebaseAdminConfigured()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or run in mock mode (SPOTLIT_MOCK=1).",
    );
  }
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID?.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.trim(),
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || ""),
    }),
  });
  return app;
}

export function adminAuth() {
  return getAuth(adminApp());
}

const g = globalThis as unknown as { __spotlitDb?: Firestore };

export function adminDb(): Firestore {
  if (db) return db;
  if (g.__spotlitDb) {
    db = g.__spotlitDb;
    return db;
  }
  db = getFirestore(adminApp());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already configured by an earlier hot reload.
  }
  g.__spotlitDb = db;
  return db;
}
