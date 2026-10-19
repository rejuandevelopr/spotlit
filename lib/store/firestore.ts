import { FieldValue, type DocumentData, type Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { isIncrement, type ListQuery, type Store, type Tx } from "./types";

type Doc = Record<string, unknown>;

/** Convert our increment sentinels (at any depth) into Firestore FieldValues. */
function toFs(data: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (isIncrement(v)) out[k] = FieldValue.increment(v.by);
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = toFs(v as Doc);
    else out[k] = v;
  }
  return out;
}

function withId<T>(id: string, data: DocumentData | undefined): T {
  return { id, ...(data ?? {}) } as T;
}

function buildQuery(collectionPath: string, q?: ListQuery): Query {
  let ref: Query = adminDb().collection(collectionPath);
  for (const [f, op, v] of q?.where ?? []) ref = ref.where(f, op, v);
  if (q?.orderBy) ref = ref.orderBy(q.orderBy[0], q.orderBy[1]);
  if (q?.limit) ref = ref.limit(q.limit);
  return ref;
}

export function firestoreStore(): Store {
  return {
    kind: "firestore",
    async get<T>(p: string) {
      const snap = await adminDb().doc(p).get();
      return snap.exists ? withId<T>(snap.id, snap.data()) : null;
    },
    async set(p, data, opts) {
      await adminDb().doc(p).set(toFs(data), { merge: !!opts?.merge });
    },
    async update(p, patch) {
      await adminDb().doc(p).update(toFs(patch));
    },
    async delete(p) {
      await adminDb().doc(p).delete();
    },
    async list<T>(collectionPath: string, q?: ListQuery) {
      const snap = await buildQuery(collectionPath, q).get();
      return snap.docs.map((d) => withId<T>(d.id, d.data()));
    },
    async count(collectionPath, q) {
      const snap = await buildQuery(collectionPath, { where: q?.where }).count().get();
      return snap.data().count;
    },
    async deleteCollection(collectionPath) {
      const db = adminDb();
      // Recursive delete handles subcollections too.
      await db.recursiveDelete(db.collection(collectionPath));
    },
    async transaction(fn) {
      const db = adminDb();
      return db.runTransaction(async (t) => {
        const tx: Tx = {
          get: async <T,>(p: string) => {
            const snap = await t.get(db.doc(p));
            return snap.exists ? withId<T>(snap.id, snap.data()) : null;
          },
          set: (p, data) => void t.set(db.doc(p), toFs(data)),
          update: (p, patch) => void t.update(db.doc(p), toFs(patch)),
          delete: (p) => void t.delete(db.doc(p)),
        };
        return fn(tx);
      });
    },
  };
}
