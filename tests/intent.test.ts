import { describe, expect, it } from "vitest";
import { parseIntent } from "@/lib/agents/intent";

describe("parseIntent", () => {
  it("reads day, time, party, budget, occasion and likes", () => {
    const i = parseIntent("Somewhere chill for a date Friday around 9pm, we're into Khruangbin and natural wine, nothing too pricey");
    expect(i.day).toBe("fri");
    expect(i.time).toBe("21:00");
    expect(i.partySize).toBe(2);
    expect(i.budget).toBe("$$");
    expect(i.occasion).toBe("date night");
    expect(i.likes.join(" ")).toMatch(/Khruangbin/);
  });
  it("handles groups and explicit dollar signs", () => {
    const i = parseIntent("Table for 6 on Saturday at 8pm, $$$");
    expect(i.partySize).toBe(6);
    expect(i.day).toBe("sat");
    expect(i.budget).toBe("$$$");
  });
});
