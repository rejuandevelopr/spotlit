// Agent Readiness Score, out of 100. Pure function, shared by server and client.
import type { CardFacts } from "@/lib/types";

export interface ReadinessItem { key: string; label: string; points: number; done: boolean; field: string }

export function readinessItems(facts: CardFacts, voice: string): ReadinessItem[] {
  const hasHours = !!facts.hours && Object.values(facts.hours).some((v) => !!v && v.trim().length > 0);
  return [
    { key: "tags", label: "Taste tags on card", points: 15, done: facts.tasteTags.length > 0, field: "tasteTags" },
    { key: "menu", label: "Drinks and dishes listed", points: 15, done: facts.dishes.length + facts.drinks.length >= 3, field: "dishes" },
    { key: "vibe", label: "Music and vibe described", points: 10, done: !!(facts.music?.trim() || facts.vibe?.trim()), field: "music" },
    { key: "hours", label: "Opening hours", points: 15, done: hasHours, field: "hours" },
    { key: "booking", label: "Booking link", points: 15, done: !!facts.booking?.trim(), field: "booking" },
    { key: "price", label: "Price band", points: 10, done: !!facts.priceBand, field: "priceBand" },
    { key: "event", label: "Upcoming event", points: 10, done: facts.events.length > 0, field: "events" },
    { key: "party", label: "Largest party size", points: 5, done: !!facts.partyMax, field: "partyMax" },
    { key: "voice", label: "Voice notes", points: 5, done: voice.trim().length > 0, field: "voice" },
  ];
}

export function readinessScore(facts: CardFacts, voice: string): number {
  return readinessItems(facts, voice).reduce((s, i) => s + (i.done ? i.points : 0), 0);
}
