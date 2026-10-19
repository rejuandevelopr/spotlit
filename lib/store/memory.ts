import fs from "node:fs";
import path from "node:path";
import { isIncrement, type ListQuery, type Store, type Tx, type Where } from "./types";

type Doc = Record<string, unknown>;

const FILE = path.join(process.cwd(), ".spotlit-mock-db.json");

interface MemState { docs: Map<string, Doc>; saveTimer: NodeJS.Timeout | null; loaded: boolean }
const g = globalThis as unknown as { __spotlitMem?: MemState };

function state(): MemState {
  if (!g.__spotlitMem) {
    g.__spotlitMem = { docs: new Map(), saveTimer: null, loaded: false };
  }
  const s = g.__spotlitMem;
  if (!s.loaded) {
    s.loaded = true;
    if (process.env.VITEST) return s;
    try {
      if (fs.existsSync(FILE)) {
        const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, Doc>;
        for (const [k, v] of Object.entries(raw)) s.docs.set(k, v);
      }
    } catch {
      // A broken file just means a fresh database.
    }
  }
  return s;
}

function scheduleSave() {
  const s = state();
  if (s.saveTimer || process.env.VITEST) return;
  s.saveTimer = setTimeout(() => {
    s.saveTimer = null;
    try {
      fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(s.docs)));
    } catch {
      // Read only file systems (serverless) keep data in memory only.
    }
  }, 400);
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

function getField(doc: Doc, field: string): unknown {
  return field.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Doc)[k] : undefined), doc);
}

function setField(doc: Doc, field: string, value: unknown) {
  const parts = field.split(".");
  let cur: Doc = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Doc;
  }
  const last = parts[parts.length - 1];
  if (isIncrement(value)) cur[last] = (Number(cur[last]) || 0) + value.by;
  else cur[last] = clone(value);
}

function applyPatch(base: Doc, patch: Doc): Doc {
  const out = clone(base);
  for (const [k, v] of Object.entries(patch)) setField(out, k, v);
  return out;
}

function merge(base: Doc, data: Doc): Doc {
  const out = clone(base);
  for (const [k, v] of Object.entries(data)) {
    if (isIncrement(v)) out[k] = (Number(out[k]) || 0) + v.by;
    else if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = merge(out[k] as Doc, v as Doc);
    } else out[k] = clone(v);
  }
  return out;
}

function resolveIncrements(data: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(data)) {
    if (isIncrement(v)) out[k] = v.by;
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = resolveIncrements(v as Doc);
    else out[k] = clone(v);
  }
  return out;
}

function matches(doc: Doc, w: Where): boolean {
  const [field, op, value] = w;
  const v = getField(doc, field);
  switch (op) {
    case "==": return v === value;
    case "!=": return v !== value;
    case "<": return (v as number) < (value as number);
    case "<=": return (v as number) <= (value as number);
    case ">": return (v as number) > (value as number);
    case ">=": return (v as number) >= (value as number);
    case "in": return Array.isArray(value) && value.includes(v);
    case "array-contains": return Array.isArray(v) && v.includes(value);
  }
}

function isDirectChild(collectionPath: string, docPath: string) {
  if (!docPath.startsWith(collectionPath + "/")) return false;
  const rest = docPath.slice(collectionPath.length + 1);
  return rest.length > 0 && !rest.includes("/");
}

function runQuery<T>(collectionPath: string, q?: ListQuery): T[] {
  const s = state();
  let rows: Doc[] = [];
  for (const [p, d] of s.docs) {
    if (!isDirectChild(collectionPath, p)) continue;
    if (q?.where && !q.where.every((w) => matches(d, w))) continue;
    rows.push({ id: p.slice(collectionPath.length + 1), ...clone(d) });
  }
  if (q?.orderBy) {
    const [f, dir] = q.orderBy;
    rows.sort((a, b) => {
      const av = getField(a, f) as number | string;
      const bv = getField(b, f) as number | string;
      if (av === bv) return 0;
      const r = av > bv ? 1 : -1;
      return dir === "asc" ? r : -r;
    });
  }
  if (q?.limit) rows = rows.slice(0, q.limit);
  return rows as T[];
}

export function memoryStore(): Store {
  return {
    kind: "memory",
    async get<T>(p: string) {
      const d = state().docs.get(p);
      return d ? ({ id: p.split("/").pop(), ...clone(d) } as T) : null;
    },
    async set(p, data, opts) {
      const s = state();
      const prev = s.docs.get(p);
      s.docs.set(p, opts?.merge && prev ? merge(prev, data) : resolveIncrements(data));
      scheduleSave();
    },
    async update(p, patch) {
      const s = state();
      const prev = s.docs.get(p);
      if (!prev) throw new Error(`No document to update: ${p}`);
      s.docs.set(p, applyPatch(prev, patch));
      scheduleSave();
    },
    async delete(p) {
      state().docs.delete(p);
      scheduleSave();
    },
    async list<T>(collectionPath: string, q?: ListQuery) {
      return runQuery<T>(collectionPath, q);
    },
    async count(collectionPath, q) {
      return runQuery(collectionPath, { where: q?.where }).length;
    },
    async deleteCollection(collectionPath) {
      const s = state();
      for (const p of [...s.docs.keys()]) if (p.startsWith(collectionPath + "/")) s.docs.delete(p);
      scheduleSave();
    },
    async transaction(fn) {
      // Single threaded JS: run the callback, then apply writes atomically.
      const writes: (() => void)[] = [];
      const tx: Tx = {
        get: async <T,>(p: string) => {
          const d = state().docs.get(p);
          return d ? ({ id: p.split("/").pop(), ...clone(d) } as T) : null;
        },
        set: (p, data) => writes.push(() => state().docs.set(p, resolveIncrements(data))),
        update: (p, patch) =>
          writes.push(() => {
            const prev = state().docs.get(p);
            if (!prev) throw new Error(`No document to update: ${p}`);
            state().docs.set(p, applyPatch(prev, patch));
          }),
        delete: (p) => writes.push(() => state().docs.delete(p)),
      };
      const r = await fn(tx);
      for (const w of writes) w();
      scheduleSave();
      return r;
    },
  };
}

/** Test helper. */
export function resetMemoryStore() {
  const s = state();
  s.docs.clear();
}
