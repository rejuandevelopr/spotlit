// Venue agent and proxy agent. Availability and price fit are computed in code from the
// agent card so the agent can never invent hours or prices. The LLM only writes the pitch.
import { z } from "zod";
import { llmObject } from "@/lib/llm";
import { publicLink } from "@/lib/links";
import { availabilityAt, priceFit } from "@/lib/arena/scoring";
import { DAY_LABEL, type AgentCardDoc, type Day, type Venue, type VenueReply } from "@/lib/types";
import type { Intent } from "./intent";

export interface VenueAsk {
  text: string;
  constraints: Partial<Intent> & { likes?: string[] };
}

const PitchOut = z.object({
  pitch: z.string().min(5).max(500),
  factsUsed: z.array(z.string()).max(10),
  fits: z.boolean(),
});

const SYSTEM_VENUE = `You are the official agent for a venue. Another AI agent asks whether the venue fits a person's request.
Reply with a short pitch (at most 2 sentences) written in the venue's voice.
Hard rules: only use facts from the agent card provided. If a fact is missing, do not guess it.
If availability is "unknown", say the hours are not listed. If "closed", say so politely.
Mention the booking link only if the card has one. List the card fields you used in factsUsed
(choose from: hours, price, music, vibe, drinks, dishes, events, booking, rules, tasteTags, voice).
Plain English, no em dashes, no hyphenated phrases.`;

const SYSTEM_PROXY = `You speak for an UNCLAIMED venue using public Qloo data only. Start with "Unclaimed listing, public data only."
Then one short sentence about what the venue is known for, using only the tags and facts given.
Never claim availability or prices unless they appear in the facts. No em dashes, no hyphenated phrases.`;

function closeTime(hours: Record<string, string> | null, day: Day): string | null {
  const v = hours?.[day];
  if (!v || v === "closed") return null;
  const m = v.match(/-\s*(\d{1,2}):?(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const suffix = h >= 12 && h < 24 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m[2] && m[2] !== "00" ? `:${m[2]}` : ""}${suffix}`;
}

function matchedLikes(likes: string[], venue: Venue, card: AgentCardDoc) {
  const hay = [card.facts.music ?? "", card.facts.vibe ?? "", ...card.facts.tasteTags, ...venue.qlooTags.map((t) => t.name), card.voice]
    .join(" ")
    .toLowerCase();
  return likes.filter((l) => l && hay.includes(l.toLowerCase()));
}

function relevantTags(occasion: string | null | undefined, card: AgentCardDoc, venue: Venue) {
  const names = card.facts.tasteTags.length ? card.facts.tasteTags : venue.qlooTags.map((t) => t.name);
  return names.slice(0, 3);
}

/** Deterministic pitch used without an LLM and as the fallback. */
export function templatePitch(venue: Venue, card: AgentCardDoc, ask: VenueAsk, availability: VenueReply["availability"]) {
  const f = card.facts;
  const day = ask.constraints.day ?? null;
  const used: string[] = [];
  const parts: string[] = [];
  const likes = matchedLikes(ask.constraints.likes ?? [], venue, card);
  const tags = relevantTags(ask.constraints.occasion, card, venue);

  if (venue.isProxy && !venue.isClaimed) {
    parts.push("Unclaimed listing, public data only.");
    parts.push(`Qloo associates ${venue.name} with ${tags.map((t) => t.toLowerCase()).join(", ") || "its neighbourhood crowd"}.`);
    used.push("tasteTags");
    if (availability === "open" && day) {
      parts.push(`Public hours show it open ${DAY_LABEL[day]}.`);
      used.push("hours");
    }
    return { pitch: parts.join(" "), factsUsed: used };
  }

  const rich = card.voice.trim().length > 40;
  if (availability === "closed") {
    parts.push(`Sorry, we're closed${day ? ` on ${DAY_LABEL[day]}` : ""} at that time.`);
    used.push("hours");
  }
  if (rich) {
    const opener = f.vibe || f.music;
    if (opener) {
      parts.push(`${opener.replace(/\.$/, "")}.`);
      used.push(f.vibe ? "vibe" : "music");
    }
    if (likes.length) parts.push(`If you like ${likes.slice(0, 2).join(" and ")}, you'll feel at home here.`);
    const drink = f.drinks[0];
    const dish = f.dishes[0];
    if (drink || dish) {
      parts.push(`Try ${[drink, dish].filter(Boolean).join(" with ")}.`);
      if (drink) used.push("drinks");
      if (dish) used.push("dishes");
    }
    if (ask.constraints.occasion === "date night" && /date|couple|two/i.test(card.voice)) {
      parts.push("It's a good room for two.");
      used.push("voice");
    }
    if (f.events.length && ask.constraints.occasion !== "brunch") {
      parts.push(`${f.events[0].title} ${f.events[0].when}.`);
      used.push("events");
    }
  } else {
    parts.push(`${venue.name} is a ${tags.slice(0, 2).join(" and ").toLowerCase() || "neighbourhood"} spot${venue.neighborhood ? ` in ${venue.neighborhood}` : ""}.`);
    used.push("tasteTags");
  }
  if (availability === "open" && day) {
    const close = closeTime(f.hours, day);
    parts.push(`We're open ${DAY_LABEL[day]}${close ? ` until ${close}` : ""}.`);
    used.push("hours");
  } else if (availability === "unknown") {
    parts.push("Our hours aren't listed yet.");
  }
  if (f.booking) {
    parts.push(`Book at ${f.booking}`);
    used.push("booking");
  }
  return { pitch: parts.join(" "), factsUsed: [...new Set(used)] };
}

export async function venueReply(venue: Venue, saved: AgentCardDoc, ask: VenueAsk, opts: { useLLM?: boolean } = {}): Promise<VenueReply> {
  const card: AgentCardDoc = { ...saved, facts: { ...saved.facts, booking: publicLink(saved.facts.booking) } };
  const c = ask.constraints;
  const isProxy = venue.isProxy && !venue.isClaimed;
  const availability = c.day && c.time ? availabilityAt(card.facts.hours, c.day, c.time) : card.facts.hours ? "open" : "unknown";
  const pf = priceFit(card.facts.priceBand, c.budget ?? null);
  const partyOk = !c.partySize || !card.facts.partyMax || c.partySize <= card.facts.partyMax;
  const base = templatePitch(venue, card, ask, availability);

  let pitch = base.pitch;
  let factsUsed = base.factsUsed;
  let fits = availability !== "closed" && pf !== "no" && partyOk;

  if (opts.useLLM !== false) {
    const out = await llmObject({
      tier: "fast",
      schema: PitchOut,
      system: isProxy ? SYSTEM_PROXY : SYSTEM_VENUE,
      cache: true,
      prompt: JSON.stringify({
        venue: { name: venue.name, neighborhood: venue.neighborhood, city: venue.city, category: venue.category },
        card: isProxy ? { tasteTags: card.facts.tasteTags, hours: card.facts.hours, priceBand: card.facts.priceBand } : { ...card.facts, voice: card.voice },
        request: ask.text,
        computed: { availability, priceFit: pf, partyFits: partyOk, day: c.day ? DAY_LABEL[c.day] : null, time: c.time },
      }),
    });
    if (out) {
      pitch = out.pitch.replace(/—/g, ",");
      factsUsed = out.factsUsed;
      fits = fits && out.fits;
      if (isProxy && !/unclaimed/i.test(pitch)) pitch = `Unclaimed listing, public data only. ${pitch}`;
    }
  }

  return {
    fits,
    availability,
    priceFit: pf,
    pitch,
    factsUsed,
    bookingLink: isProxy ? null : card.facts.booking,
  };
}

/** Text describing the venue for occasion matching (tags, vibe, music, menu). */
export function venueText(venue: Venue, card: AgentCardDoc) {
  return [
    venue.name,
    card.facts.vibe,
    card.facts.music,
    card.voice,
    ...card.facts.tasteTags,
    ...card.facts.drinks,
    ...card.facts.dishes,
    ...venue.qlooTags.map((t) => t.name),
  ]
    .filter(Boolean)
    .join(" ");
}
