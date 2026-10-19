"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseClientConfigured = () => !!(config.apiKey && config.authDomain && config.projectId);

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

/** Google sign in with a popup (redirects are unreliable on non Firebase hosting). */
export async function googleIdToken(): Promise<string> {
  const auth = getAuth(app());
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  return cred.user.getIdToken();
}

export async function firebaseSignOut() {
  if (!firebaseClientConfigured()) return;
  try {
    await fbSignOut(getAuth(app()));
  } catch {
    // Already signed out.
  }
}
