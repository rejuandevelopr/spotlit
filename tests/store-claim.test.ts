import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/lib/store/memory";
import { claimVenue, createVenue, getVenue } from "@/lib/venues";
import { emptyFacts } from "@/lib/types";


describe("claim transaction", () => {
  beforeEach(() => resetMemoryStore());

  it("first claim wins, second gets already_claimed", async () => {
    const v = await createVenue({ name: "Test Bar", city: "New York", category: "bar" }, emptyFacts());
    expect(await claimVenue(v.id, "alice", "owner")).toBe("ok");
    expect(await claimVenue(v.id, "bob", "owner")).toBe("already_claimed");
    const after = await getVenue(v.id);
    expect(after?.ownerId).toBe("alice");
    expect(after?.isClaimed).toBe(true);
    expect(after?.isProxy).toBe(false);
  });

  it("gives every venue a unique slug", async () => {
    const a = await createVenue({ name: "Same Name", city: "New York", category: "bar" }, emptyFacts());
    const b = await createVenue({ name: "Same Name", city: "New York", category: "bar" }, emptyFacts());
    expect(a.slug).not.toBe(b.slug);
  });

  it("returns not_found for missing venues", async () => {
    expect(await claimVenue("nope", "alice", "owner")).toBe("not_found");
  });
});
