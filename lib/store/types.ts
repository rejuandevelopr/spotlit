export type WhereOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
export type Where = [field: string, op: WhereOp, value: unknown];

export interface ListQuery {
  where?: Where[];
  orderBy?: [field: string, dir: "asc" | "desc"];
  limit?: number;
}

/** Sentinel for atomic numeric increments. */
export interface IncrementOp { __op: "increment"; by: number }
export const increment = (by: number): IncrementOp => ({ __op: "increment", by });
export const isIncrement = (v: unknown): v is IncrementOp =>
  typeof v === "object" && v !== null && (v as IncrementOp).__op === "increment";

export interface Tx {
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: Record<string, unknown>): void;
  update(path: string, patch: Record<string, unknown>): void;
  delete(path: string): void;
}

/**
 * A tiny document store with the subset of Firestore we use. Paths look like
 * "venues/abc" (documents) and "venues/abc/cards" (collections).
 */
export interface Store {
  kind: "firestore" | "memory";
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: Record<string, unknown>, opts?: { merge?: boolean }): Promise<void>;
  update(path: string, patch: Record<string, unknown>): Promise<void>;
  delete(path: string): Promise<void>;
  list<T>(collectionPath: string, q?: ListQuery): Promise<T[]>;
  count(collectionPath: string, q?: ListQuery): Promise<number>;
  deleteCollection(collectionPath: string): Promise<void>;
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}
