import { describe, expect, it } from "vitest";
import {
  WEIGHTS,
  availabilityAt,
  combineAffinity,
  constraintFit,
  decide,
  minMax,
  priceFit,
  reasonCodes,
  score,
  summarize,
  tagOverlap,
} from "@/lib/arena/scoring";
import type { CandidateResult, RoundDoc, Segment, VenueReply } from "@/lib/types";

const reply = (over: Partial<VenueReply> = {}): VenueReply => ({
  fits: true,
  availability: "open",
  priceFit: "yes",
  pitch: "A long enough pitch with Khruangbin on vinyl and a natural wine list.",
  factsUsed: ["hours", "music"],
  bookingLink: null,
  ...over,
});

const cand = (over: Partial<CandidateResult>): CandidateResult => ({
  venueId: "v",
  name: "V",
  isTarget: false,
  isProxy: true,
  affinity: 0.5,
  normAffinity: 0.5,
  C: 0.5,
  Q: 0.5,
  score: 0,
  reply: reply(),
  asked: true,
  ...over,
});

describe("weights", () => {
  it("Qloo taste decides 60% of every verdict", () => {
    expect(WEIGHTS.A).toBe(0.6);
    expect(WEIGHTS.A + WEIGHTS.C + WEIGHTS.Q).toBeCloseTo(1);
    expect(score(1, 0, 0)).toBeCloseTo(0.6);
  });
});

describe("minMax", () => {
  it("normalises to 0..1 and handles ties", () => {
    expect(minMax([2, 4, 6])).toEqual([0, 0.5, 1]);
    expect(minMax([3, 3])).toEqual([0.5, 0.5]);
    expect(minMax([])).toEqual([]);
  });
});

describe("combineAffinity", () => {
  it("uses tag match only when any candidate lacks a Qloo entity", () => {
    expect(combineAffinity([0.2, 0.8], [null, 0.9])).toEqual([0, 1]);
  });
  it("averages tag and entity affinity when every candidate has an entity", () => {
    const out = combineAffinity([0.2, 0.8], [0.9, 0.1]);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(0.5);
  });
});

describe("tagOverlap", () => {
  it("is higher when the venue shares the persona's strongest tags", () => {
    const persona = new Map<string, number>([
      ["urn:a", 0.9],
      ["a", 0.9],
      ["urn:b", 0.1],
      ["b", 0.1],
    ]);
    const vinyl = tagOverlap([{ id: "urn:a", name: "A", affinity: 1 }], persona);
    const other = tagOverlap([{ id: "urn:b", name: "B", affinity: 1 }], persona);
    expect(vinyl).toBeGreaterThan(other);
    expect(tagOverlap([], persona)).toBe(0);
  });
});

describe("availability", () => {
  const hours = { mon: "closed", fri: "17:00-02:00", sat: "17:00-02:00" };
  it("reads open, closed and unknown from the card", () => {
    expect(availabilityAt(hours, "fri", "21:00")).toBe("open");
    expect(availabilityAt(hours, "mon", "21:00")).toBe("closed");
    expect(availabilityAt(hours, "tue", "21:00")).toBe("unknown");
    expect(availabilityAt(null, "fri", "21:00")).toBe("unknown");
  });
  it("handles hours that run past midnight", () => {
    expect(availabilityAt(hours, "sat", "00:30")).toBe("open");
    expect(availabilityAt(hours, "fri", "16:00")).toBe("closed");
  });
});

describe("priceFit", () => {
  it("compares price band with budget", () => {
    expect(priceFit("$$", "$$$")).toBe("yes");
    expect(priceFit("$$$", "$")).toBe("no");
    expect(priceFit(null, "$$")).toBe("unknown");
  });
});

describe("constraintFit", () => {
  it("penalises unknown hours and closed venues", () => {
    const base = { partySize: 2, partyMax: 8, occasion: "date night", venueText: "dim romantic wine" };
    const open = constraintFit(reply(), base);
    const unknown = constraintFit(reply({ availability: "unknown" }), base);
    const closed = constraintFit(reply({ availability: "closed" }), base);
    expect(open).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(closed);
  });
});

describe("reason codes", () => {
  it("flags INFO_GAP when the target answered unknown", () => {
    const target = cand({ isTarget: true, normAffinity: 0.8, reply: reply({ availability: "unknown" }) });
    const winner = cand({ normAffinity: 0.85 });
    expect(reasonCodes(target, winner)).toContain("INFO_GAP");
  });
  it("flags TASTE_GAP when the winner's affinity is more than 0.15 higher", () => {
    const target = cand({ isTarget: true, normAffinity: 0.2 });
    const winner = cand({ normAffinity: 0.9 });
    expect(reasonCodes(target, winner)[0]).toBe("TASTE_GAP");
  });
  it("puts CLOSED first when the target was closed", () => {
    const target = cand({ isTarget: true, reply: reply({ availability: "closed" }) });
    expect(reasonCodes(target, cand({}))[0]).toBe("CLOSED");
  });
  it("flags PITCH_GAP when the winner's answer was much better", () => {
    const target = cand({ isTarget: true, Q: 0.2, normAffinity: 0.8 });
    const winner = cand({ Q: 0.7, normAffinity: 0.8 });
    expect(reasonCodes(target, winner)).toContain("PITCH_GAP");
  });
});

describe("decide", () => {
  it("only lets asked candidates win and gives no codes when the target wins", () => {
    const t = cand({ venueId: "t", isTarget: true, score: 0.7 });
    const notAsked = cand({ venueId: "x", score: 0.9, asked: false });
    const r = decide([t, notAsked]);
    expect(r.winner.venueId).toBe("t");
    expect(r.codes).toEqual([]);
  });
});

describe("summarize", () => {
  it("computes Share of Agent Voice and counts each loss once", () => {
    const seg: Segment = { id: "s", name: "Seg", tagIds: [], tagNames: [], weight: 1, occasions: [], seedPool: [], evidence: null };
    const mk = (i: number, won: boolean): RoundDoc =>
      ({
        id: `p${i}`,
        index: i,
        status: "done",
        persona: { segmentId: "s", segmentName: "Seg" },
        winnerVenueId: won ? "t" : "r",
        winnerName: won ? "T" : "Rival",
        targetWon: won,
        reasonCodes: won ? [] : ["INFO_GAP", "TASTE_GAP"],
      }) as unknown as RoundDoc;
    const s = summarize([mk(0, true), mk(1, false), mk(2, false), mk(3, true)], [seg], "t");
    expect(s.soav).toBe(0.5);
    expect(s.wins).toBe(2);
    expect(s.reasonCodes.INFO_GAP).toBe(2);
    expect(s.reasonCodes.TASTE_GAP).toBe(0);
    expect(s.lostTo[0]).toMatchObject({ venueId: "r", losses: 2, mainReason: "INFO_GAP" });
    expect(s.bySegment[0]).toMatchObject({ n: 4, wins: 2 });
  });
});
