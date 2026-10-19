// A2A agent card for a venue (A2A protocol v0.3 field names).
import { env } from "@/lib/env";
import type { AgentCardDoc, Venue } from "@/lib/types";

export const A2A_PROTOCOL_VERSION = "0.3.0";

export function agentCardUrl(slug: string) {
  return `${env.appUrl}/v/${slug}/.well-known/agent-card.json`;
}
export function agentEndpoint(slug: string) {
  return `${env.appUrl}/v/${slug}/a2a`;
}

export function buildAgentCard(venue: Venue, card: AgentCardDoc | null) {
  const unclaimed = !venue.isClaimed;
  const where = [venue.neighborhood, venue.city].filter(Boolean).join(", ");
  return {
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: `${venue.name}${unclaimed ? " (unclaimed)" : ""}`,
    description: unclaimed
      ? `Proxy agent for ${venue.name} in ${where}. Unclaimed, public data only. Built by Spotlit from Qloo taste data.`
      : `Official agent for ${venue.name}, ${where}. Answers fit, availability, menu highlights and booking questions from the venue's own agent card.`,
    url: agentEndpoint(venue.slug),
    preferredTransport: "JSONRPC",
    version: `${card?.version ?? 0}.0.0`,
    provider: { organization: "Spotlit", url: env.appUrl },
    documentationUrl: `${env.appUrl}/v/${venue.slug}`,
    iconUrl: `${env.appUrl}/brand/spotlit-o-mark-orange.svg`,
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [
      {
        id: "check_fit",
        name: "Check fit",
        description: "Does this venue fit a request (occasion, taste, party size, budget)?",
        tags: ["fit", "taste", "recommendation"],
        examples: ["Somewhere chill for a date Friday, we love Khruangbin and natural wine"],
      },
      {
        id: "check_availability",
        name: "Check availability",
        description: "Is the venue open at a given day and time? Answers unknown when hours are not listed.",
        tags: ["hours", "availability"],
        examples: ["Are you open Saturday at 10pm?"],
      },
      {
        id: "get_menu_highlights",
        name: "Menu highlights",
        description: "Signature drinks and dishes from the agent card.",
        tags: ["menu", "drinks", "food"],
        examples: ["What should we order?"],
      },
      {
        id: "request_booking",
        name: "Request booking",
        description: "Returns the venue's booking link. Never books on its own.",
        tags: ["booking"],
        examples: ["Table for two Friday at 9?"],
      },
    ],
    spotlit: {
      claimed: venue.isClaimed,
      fictional: venue.isFictional,
      category: venue.category,
      tasteTags: (card?.facts.tasteTags.length ? card.facts.tasteTags : venue.qlooTags.map((t) => t.name)).slice(0, 8),
      readiness: card?.readiness ?? 0,
      dataSource: unclaimed ? "Qloo public data only" : "Venue agent card",
    },
  };
}
