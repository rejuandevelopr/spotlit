import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/lib/store/memory";
import { createVenue } from "@/lib/venues";
import { handleA2A } from "@/lib/a2a/server";
import { handleMcp } from "@/lib/mcp";
import { emptyFacts } from "@/lib/types";


describe("A2A message/send", () => {
  beforeEach(() => resetMemoryStore());

  it("answers unknown when hours are missing, and never invents them", async () => {
    await createVenue({ name: "Card Bar", city: "New York", category: "bar", slug: "card-bar" }, { ...emptyFacts(), priceBand: "$$" });
    const { response, reply } = await handleA2A("card-bar", {
      jsonrpc: "2.0",
      id: 1,
      method: "message/send",
      params: { message: { role: "user", messageId: "m1", parts: [{ kind: "text", text: "Table for two Friday at 9pm?" }] } },
    });
    expect("result" in response).toBe(true);
    expect(reply?.availability).toBe("unknown");
    expect(reply?.priceFit).toBe("unknown");
  });

  it("returns JSON-RPC errors for bad requests", async () => {
    const { response } = await handleA2A("nope", { jsonrpc: "2.0", id: 2, method: "message/send", params: { message: { parts: [{ kind: "text", text: "hi" }] } } });
    expect("error" in response).toBe(true);
    const bad = await handleA2A("nope", { hello: "world" });
    expect("error" in bad.response).toBe(true);
  });
});

describe("MCP", () => {
  it("initializes and lists the three tools", async () => {
    const init = (await handleMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, "claude-code/2.0")) as { result: { protocolVersion: string } };
    expect(init.result.protocolVersion).toBe("2025-06-18");
    const list = (await handleMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, null)) as { result: { tools: { name: string }[] } };
    expect(list.result.tools.map((t) => t.name)).toEqual(["find_venue_for_taste", "ask_venue", "get_taste_dna"]);
    expect(await handleMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, null)).toBeNull();
  });
});
