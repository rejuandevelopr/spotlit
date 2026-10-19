import { describe, expect, it } from "vitest";
import { rankPlaces } from "@/lib/qloo/rank";
const p = (id: string, name: string, address: string | null = null) => ({ id, name, address, lat: null, lng: null, tags: [], affinity: null, priceLevel: null, hours: null, website: null, rating: null, neighborhood: null, isClosed: false, types: [] });
describe("rankPlaces", () => {
  it("keeps the real match and drops noise", () => {
    const out = rankPlaces("Death & Co", "New York", [
      p("1", "Bubba Gump Shrimp Co."), p("2", "Death & Co East Village", "433 E 6th St, New York, NY 10009"),
      p("3", "Antonio's Real New York Pizza", "1560 Big Thompson Ave Estes Park, CO 80517"), p("4", "Columbia University"),
    ], 8);
    expect(out.map((x) => x.id)).toEqual(["2"]);
  });
  it("keeps everything when nothing matches well", () => {
    expect(rankPlaces("zzz", null, [p("1", "A"), p("2", "B")], 8)).toHaveLength(2);
  });
});

import { tagKind } from "@/lib/qloo/parse";
describe("tagKind", () => {
  it("sorts real Qloo subtypes", () => {
    expect(tagKind({ id: "urn:tag:credit_card:place:discover", name: "Discover", type: "urn:tag:credit_card:place" })).toBe("noise");
    expect(tagKind({ id: "x", name: "Wings", type: "urn:tag:specialty_dish:place" })).toBe("dining");
    expect(tagKind({ id: "x", name: "New American", type: "urn:tag:genre:place" })).toBe("taste");
    expect(tagKind({ id: "x", name: "Four Star", type: "urn:tag:x:place" })).toBe("noise");
  });
});

import { normRange, normTime } from "@/lib/qloo/parse";
describe("hours", () => {
  it("normalises Qloo times", () => {
    expect(normTime("T18:00")).toBe("18:00");
    expect(normTime("T9:30:00")).toBe("09:30");
    expect(normRange("T18:0-T01:0")).toBe("18:00-01:00");
    expect(normRange("T18:3-T02:0")).toBe("18:30-02:00");
    expect(normRange("closed")).toBe("closed");
  });
});

import { normQ } from "@/lib/agents/concierge";
describe("normQ", () => {
  it("accepts any rating scale", () => {
    expect(normQ(0.7)).toBe(0.7);
    expect(normQ(7)).toBe(0.7);
    expect(normQ(70)).toBe(0.7);
    expect(normQ(-1)).toBe(0);
    expect(normQ(NaN)).toBe(0.5);
  });
});

describe("style tags", () => {
  it("drops generic style tags", () => {
    for (const name of ["Pop Vibe", "Pop Vibes", "Hip Hop Aesthetic", "Music Pub Decor", "Decor", "Disco-Bar Vibe", "Pop Style"])
      expect(tagKind({ id: "x", name, type: "urn:tag:keyword:place" })).toBe("noise");
    for (const name of ["Hip Hop", "Natural Wine", "Vinyl", "City Pop", "Mixology education"])
      expect(tagKind({ id: "x", name, type: "urn:tag:keyword:place" })).not.toBe("noise");
  });
});

import { nameScore } from "@/lib/qloo/rank";
describe("nameScore prefixes", () => {
  it("does not match short prefixes", () => {
    expect(nameScore("hi fi sound", "Lo Fi Hip Hop")).toBeLessThan(0.5);
    expect(nameScore("natural wine", "Natural Wine")).toBeGreaterThanOrEqual(1);
  });
});
