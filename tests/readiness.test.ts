import { describe, expect, it } from "vitest";
import { readinessItems, readinessScore } from "@/lib/readiness";
import { emptyFacts } from "@/lib/types";

describe("readiness", () => {
  it("is 0 for an empty card and 100 for a complete one", () => {
    expect(readinessScore(emptyFacts(), "")).toBe(0);
    const full = {
      ...emptyFacts(),
      hours: { mon: "closed", tue: "17:00-00:00", wed: "17:00-00:00", thu: "17:00-01:00", fri: "17:00-02:00", sat: "17:00-02:00", sun: "closed" },
      priceBand: "$$" as const,
      partyMax: 8,
      booking: "https://example.com",
      dishes: ["a", "b"],
      drinks: ["c"],
      music: "vinyl",
      events: [{ title: "Jazz night", when: "Thursdays" }],
      tasteTags: ["Vinyl listening"],
    };
    expect(readinessScore(full, "Warm")).toBe(100);
  });
  it("matches the demo story: no hours, booking or events is 60", () => {
    const f = { ...emptyFacts(), priceBand: "$$" as const, partyMax: 8, dishes: ["a", "b", "c"], music: "vinyl", tasteTags: ["x"] };
    expect(readinessScore(f, "Friendly and relaxed.")).toBe(60);
    expect(readinessItems(f, "").filter((i) => !i.done).map((i) => i.key)).toEqual(expect.arrayContaining(["hours", "booking", "event"]));
  });
  it("weights add up to 100", () => {
    expect(readinessItems(emptyFacts(), "").reduce((s, i) => s + i.points, 0)).toBe(100);
  });
});
