// Strategist chat: LLM with Qloo evidence tools when configured, deterministic answers otherwise.
import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { hasLLM } from "@/lib/env";
import { model } from "@/lib/llm";
import type { ActionDoc, ReasonCode, RunDoc, Venue } from "@/lib/types";

export interface ChatMsg { role: "user" | "assistant"; content: string }

export function openerFor(run: RunDoc, actions: ActionDoc[]): string {
  const s = run.summary;
  if (!s) return "Run the arena first and I will explain every lost pick.";
  const codes = (Object.entries(s.reasonCodes) as [ReasonCode, number][]).sort((a, b) => b[1] - a[1]);
  const [top, n] = codes[0] ?? ["TASTE_GAP", 0];
  const first = actions[0];
  const lead: Record<ReasonCode, string> = {
    INFO_GAP: `Your biggest leak is simple: ${n} personas got "unknown" when they asked about hours or price. That's fixable in a minute and I can measure it with the same ${s.total} personas.`,
    TASTE_GAP: `Most losses (${n}) are taste: a rival matched the persona better. Some of that is who you are, and some of it you can win with programming.`,
    PITCH_GAP: `${n} times your reply was vaguer than the winner's. Specific beats generic: one record, one seat, one glass.`,
    CLOSED: `${n} requests came when you were closed. That's a business decision, so I'll estimate it rather than measure it.`,
  };
  const cardLosses = (s.reasonCodes.INFO_GAP ?? 0) + (s.reasonCodes.PITCH_GAP ?? 0);
  const cardNote =
    cardLosses === 0 && s.total > s.wins
      ? " Your agent card already answers agents well, so card fixes will move little. Your next picks come from programming and hours."
      : "";
  return `${lead[top]}${cardNote}${first ? ` Start with "${first.title}".` : ""} Ask me about any segment.`;
}

function contextFor(venue: Venue, run: RunDoc, actions: ActionDoc[]) {
  return JSON.stringify({
    venue: { name: venue.name, neighborhood: venue.neighborhood, city: venue.city, tasteTags: venue.qlooTags.slice(0, 10).map((t) => t.name) },
    report: run.summary,
    analyst: run.analyst?.narrative,
    segments: run.segments.map((s) => ({ id: s.id, name: s.name, tags: s.tagNames, topArtists: s.seedPool.filter((x) => x.type === "artist").slice(0, 4).map((x) => `${x.name} ${x.affinity?.toFixed(2) ?? ""}`) })),
    actions: actions.map((a) => ({ rank: a.rank, title: a.title, kind: a.kind, liftType: a.liftType, estLift: a.estLift, measuredLift: a.measuredLift, reason: a.reasonCode })),
  });
}

const SYSTEM = `You are the Growth Strategist for an independent venue, inside Spotlit.
You explain Agent Arena simulation results and recommend fixes. Every claim must cite Qloo evidence from the context or from the qlooEvidence tool.
Numbers come from code: quote them, never invent new ones. Card and pitch fixes have measured lift (re-run with the same personas); events, menus and hours changes have estimated lift and are never added to the measured score.
When you discuss a segment, add a line with exactly [[evidence:SEGMENT_ID]] so the app shows the Qloo evidence chips.
Be brief: at most 4 short sentences. Plain English, no em dashes, no hyphenated phrases, no markdown headings.`;

export function strategistStream(venue: Venue, run: RunDoc, actions: ActionDoc[], messages: ChatMsg[]): Response {
  if (!hasLLM()) return textResponse(ruleReply(venue, run, actions, messages[messages.length - 1]?.content ?? ""));
  const result = streamText({
    model: model("smart"),
    system: `${SYSTEM}\n\nContext:\n${contextFor(venue, run, actions)}`,
    messages,
    temperature: 0.4,
    stopWhen: stepCountIs(3),
    tools: {
      qlooEvidence: tool({
        description: "Qloo evidence for a taste segment: its tags and the artists, films and brands it is associated with, with affinity scores.",
        inputSchema: z.object({ segment: z.string().describe("Segment id or name") }),
        execute: async ({ segment }) => {
          const s = run.segments.find((x) => x.id === segment || x.name.toLowerCase() === segment.toLowerCase());
          if (!s) return { error: "Unknown segment", segments: run.segments.map((x) => x.name) };
          const seg = run.summary?.bySegment.find((b) => b.segmentId === s.id);
          return { id: s.id, name: s.name, tags: s.tagNames, wins: seg?.wins, personas: seg?.n, associations: s.seedPool.slice(0, 10).map((x) => ({ name: x.name, type: x.type, affinity: x.affinity })) };
        },
      }),
    },
    onError: ({ error }) => console.warn("[strategist] stream error", error),
  });
  return result.toTextStreamResponse();
}

function textResponse(text: string) {
  // Stream word by word so the UI behaves the same with or without an LLM.
  const words = text.split(/(\s+)/);
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      for (const w of words) {
        controller.enqueue(enc.encode(w));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

const KEYWORDS: Record<string, string[]> = {
  vinyl: ["vinyl", "record", "hi fi", "listening"],
  wine: ["wine", "natural", "orange"],
  date: ["date", "romantic", "couple"],
  jazz: ["jazz", "soul", "after work"],
  dj: ["dj", "dance", "late", "club", "techno", "house"],
  brunch: ["brunch", "sunday", "daytime", "group"],
  cocktail: ["cocktail"],
  foodie: ["food", "foodie", "dinner", "menu"],
};

export function ruleReply(venue: Venue, run: RunDoc, actions: ActionDoc[], question: string): string {
  const q = question.toLowerCase();
  const s = run.summary;
  if (!s) return "This run has no results yet.";
  const seg = run.segments.find((x) => q.includes(x.name.toLowerCase()) || (KEYWORDS[x.id] ?? []).some((k) => q.includes(k)));
  if (seg) {
    const b = s.bySegment.find((x) => x.segmentId === seg.id);
    const artists = seg.seedPool.filter((x) => x.type === "artist").slice(0, 3).map((x) => x.name);
    const act = actions.find((a) => a.segmentName === seg.name);
    const rival = s.lostTo.find((l) => l.topSegment === seg.name);
    return [
      `${seg.name}: you won ${b?.wins ?? 0} of ${b?.n ?? 0} in this simulation${rival ? `, and ${rival.name} took the most of them, mostly on ${rival.mainReason?.replace("_", " ").toLowerCase()}` : ""}.`,
      `Qloo links this crowd to ${seg.tagNames.slice(0, 2).join(" and ").toLowerCase()} and to ${artists.join(", ")}.`,
      act ? `My move here is "${act.title}" (${act.liftType} lift ${act.estLift >= 0 ? "+" : ""}${act.estLift}).` : "None of my five moves targets them yet; a themed night built on those artists is the next idea to test.",
      `[[evidence:${seg.id}]]`,
    ].join("\n");
  }
  if (/hour|open|unknown|info/.test(q)) {
    return `INFO_GAP means your agent answered "unknown" for hours or price, so the concierge picked a venue that could confirm. It caused ${s.reasonCodes.INFO_GAP} of your losses. Add hours and a booking link, then re-run: the same personas will show the measured change.`;
  }
  if (/pitch|generic|voice|reply/.test(q)) {
    return `Answer quality is 15% of the score. Replies that name a drink, a seat or a record score higher than a listing. ${s.reasonCodes.PITCH_GAP} losses were mainly about the pitch. Give your agent specific voice notes on the card page.`;
  }
  if (/score|weight|fair|qloo|how/.test(q)) {
    return `Every verdict is 60% Qloo taste affinity, 25% fit for the plan (open, price, party size, occasion) and 15% answer quality. Taste comes from Qloo: the persona's seeds and your venue's tags are both Qloo data. Fit is computed from your card, so the agent can never invent hours.`;
  }
  const list = actions.slice(0, 3).map((a) => `${a.rank}. ${a.title} (${a.liftType})`).join("\n");
  return `Here is where I would start for ${venue.name}:\n${list}\nAsk me about a segment, like jazz or brunch, and I will show the Qloo evidence.`;
}
