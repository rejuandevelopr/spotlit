import { env } from "@/lib/env";
import { memoryStore } from "./memory";
import { firestoreStore } from "./firestore";
import type { Store } from "./types";

export * from "./types";

let store: Store | null = null;

/** The app database: Firestore in production, an in-memory store in mock mode. */
export function db(): Store {
  if (store) return store;
  store = env.mock || process.env.SPOTLIT_STORE === "memory" ? memoryStore() : firestoreStore();
  return store;
}

export const newId = (len = 20) => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
};

export const now = () => Date.now();
