// Persona agent: writes the one sentence a real person would type to an assistant.
import { z } from "zod";
import { llmObject } from "@/lib/llm";
import { mulberry32, pick } from "@/lib/rng";
import { DAY_LABEL, type Persona } from "@/lib/types";

const SYSTEM = `You write one realistic message a person sends to an AI assistant asking for a place to go out.
Rules: one or two short sentences, casual, first person. Mention one or two of their tastes by name naturally.
Include the day and rough time, party size when it is not one, and the budget feel. Never name a venue.
Use plain English. No em dashes, no hyphenated phrases.`;

const Out = z.object({ requestText: z.string().min(10).max(300) });

function timePhrase(time: string) {
  const h = Number(time.split(":")[0]);
  if (h < 12 && h >= 6) return "around noon";
  if (h < 17 && h >= 12) return "in the afternoon";
  if (h < 19 && h >= 17) return "right after work";
  if (h < 21) return "around 8";
  if (h < 23) return "around 10";
  return "late";
}

const BUDGET = { $: "keep it cheap", $$: "nothing too pricey", $$$: "happy to splurge" };

export function templateRequest(p: Persona, city: string): string {
  const r = mulberry32(p.index * 7919 + 17);
  const day = DAY_LABEL[p.slot.day];
  // People describe their taste with music and films first. Brands read oddly in a dinner request.
  const ordered = [...p.seeds.filter((s) => !/brand/i.test(s.type ?? "")), ...p.seeds.filter((s) => /brand/i.test(s.type ?? ""))];
  const likes = ordered.slice(0, 2).map((s) => s.name);
  const likesText = likes.length === 2 ? `${likes[0]} and ${likes[1]}` : likes[0] ?? "good music";
  const party = p.partySize === 1 ? "just me" : p.partySize === 2 ? "two of us" : `${p.partySize} of us`;
  const area = city.includes("New York") ? "Brooklyn" : city;
  const starts: Record<string, string[]> = {
    "date night": [`Somewhere chill for a date ${day}`, `Need a date spot for ${day} night`],
    "group dinner": [`Looking for a place for a group dinner ${day}`, `${party}, dinner and drinks ${day}`],
    "solo drink": [`Want a quiet drink on my own ${day}`, `Good bar to sit solo ${day}?`],
    "live music": [`Any good live music spots ${day}?`, `Where can we hear good music ${day}`],
    "after work": [`After work drinks ${day}`, `Somewhere for a drink after work ${day}`],
    brunch: [`Brunch spot for ${day}?`, `Need a brunch place ${day}`],
    "late night": [`Where's good late ${day}?`, `Late night plans ${day}, where should we go`],
  };
  const start = pick(r, starts[p.occasion] ?? starts["after work"]);
  const mids = [`we're into ${likesText}`, `big fans of ${likesText}`, `I love ${likesText}`];
  return `${start} ${timePhrase(p.slot.time)} in ${area}, ${party}. ${pick(r, mids).replace(/^./, (c) => c.toUpperCase())}, ${BUDGET[p.budget]}.`;
}

export async function personaRequest(p: Persona, city: string): Promise<string> {
  const out = await llmObject({
    tier: "fast",
    schema: Out,
    system: SYSTEM,
    cache: true,
    temperature: 0.8,
    prompt: JSON.stringify({
      name: p.displayName,
      city: city.includes("New York") ? "Brooklyn, New York" : city,
      occasion: p.occasion,
      day: DAY_LABEL[p.slot.day],
      time: p.slot.time,
      partySize: p.partySize,
      budget: p.budget,
      tastes: p.seeds.map((s) => `${s.name} (${s.type})`),
    }),
  });
  const text = out?.requestText?.replace(/—/g, ",").trim();
  return text && text.length > 10 ? text : templateRequest(p, city);
}
