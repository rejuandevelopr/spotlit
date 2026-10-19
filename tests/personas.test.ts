import { describe, expect, it } from "vitest";
import { buildPersonas } from "@/lib/arena/personas";
import { allocate, mulberry32 } from "@/lib/rng";
import type { Segment } from "@/lib/types";

const pool = (prefix: string) => [
  { id: `${prefix}-a1`, name: `${prefix} Artist 1`, type: "artist", affinity: 0.9 },
  { id: `${prefix}-a2`, name: `${prefix} Artist 2`, type: "artist", affinity: 0.8 },
  { id: `${prefix}-a3`, name: `${prefix} Artist 3`, type: "artist", affinity: 0.7 },
  { id: `${prefix}-m1`, name: `${prefix} Film`, type: "movie", affinity: 0.8 },
  { id: `${prefix}-b1`, name: `${prefix} Brand`, type: "brand", affinity: 0.6 },
];

const segments: Segment[] = ["vinyl", "wine", "date", "jazz", "dj", "brunch"].map((id, i) => ({
  id,
  name: id,
  tagIds: [`urn:tag:${id}`],
  tagNames: [id],
  weight: 1 + i * 0.1,
  occasions: ["date night", "after work"],
  seedPool: pool(id),
  evidence: null,
}));

describe("mulberry32", () => {
  it("is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("allocate", () => {
  it("allocates exactly n with at least one per bucket", () => {
    const out = allocate(60, [1, 1, 1, 1, 1, 0.1]);
    expect(out.reduce((s, x) => s + x, 0)).toBe(60);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(1);
  });
});

describe("buildPersonas", () => {
  it("same seed gives the same personas", () => {
    const a = buildPersonas(20261030, segments, 60);
    const b = buildPersonas(20261030, segments, 60);
    expect(a).toEqual(b);
    expect(a).toHaveLength(60);
  });
  it("different seeds give different personas", () => {
    const a = buildPersonas(1, segments, 24);
    const b = buildPersonas(2, segments, 24);
    expect(a).not.toEqual(b);
  });
  it("gives every persona 3 to 5 Qloo seeds and a valid slot", () => {
    for (const p of buildPersonas(7, segments, 60)) {
      expect(p.seeds.length).toBeGreaterThanOrEqual(3);
      expect(p.seeds.length).toBeLessThanOrEqual(5);
      expect(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]).toContain(p.slot.day);
      expect(p.partySize).toBeGreaterThanOrEqual(1);
    }
  });
});

import { templateRequest } from "@/lib/agents/persona";
describe("templateRequest area", () => {
  it("asks for the venue's neighbourhood", () => {
    const p = buildPersonas(7, segments, 6)[0];
    expect(templateRequest(p, "New York", "West Village")).toContain("in West Village");
    expect(templateRequest(p, "New York")).toContain("in Brooklyn");
  });
});
