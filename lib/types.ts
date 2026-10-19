import { z } from "zod";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABEL: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export const CATEGORIES = ["bar", "restaurant", "cafe", "music_venue"] as const;
export type Category = (typeof CATEGORIES)[number];

// ---------- Evidence ----------
export interface Evidence {
  callId: string;
  path: string;
  params: Record<string, string>;
}

// ---------- Agent card ----------
/** A day is "closed", a range like "17:00-01:00", or missing (unknown). */
export const HoursSchema = z.record(z.enum(DAYS), z.string().max(40)).nullable();

export const EventSchema = z.object({
  title: z.string().min(1).max(120),
  when: z.string().max(80),
});

export const CardFactsSchema = z.object({
  hours: HoursSchema,
  priceBand: z.enum(["$", "$$", "$$$", "$$$$"]).nullable(),
  partyMax: z.number().int().min(1).max(500).nullable(),
  booking: z.string().max(300).nullable(),
  address: z.string().max(200).nullable(),
  dishes: z.array(z.string().max(80)).max(30),
  drinks: z.array(z.string().max(80)).max(30),
  music: z.string().max(300).nullable(),
  vibe: z.string().max(300).nullable(),
  rules: z.array(z.string().max(120)).max(20),
  events: z.array(EventSchema).max(20),
  tasteTags: z.array(z.string().max(60)).max(20),
});
export type CardFacts = z.infer<typeof CardFactsSchema>;
export type VenueEvent = z.infer<typeof EventSchema>;

export const emptyFacts = (): CardFacts => ({
  hours: null, priceBand: null, partyMax: null, booking: null, address: null,
  dishes: [], drinks: [], music: null, vibe: null, rules: [], events: [], tasteTags: [],
});

export interface AgentCardDoc {
  version: number;
  facts: CardFacts;
  voice: string;
  readiness: number;
  createdAt: number;
  note?: string;
}

// ---------- Venue ----------
export interface Venue {
  id: string;
  slug: string;
  name: string;
  city: string;
  neighborhood: string | null;
  category: Category;
  qlooEntityId: string | null;
  ownerId: string | null;
  isClaimed: boolean;
  isFictional: boolean;
  isProxy: boolean;
  descriptionTags: string[];
  lat: number | null;
  lng: number | null;
  address: string | null;
  qlooTags: TagRef[];
  latestCardVersion: number;
  readiness: number;
  latestRunId: string | null;
  latestSoav: number | null;
  setupStep: number; // 1 found, 2 claimed, 3 dna, 4 card, 5 arena
  ownerRole?: string | null;
  createdAt: number;
}

export interface TagRef { id: string; name: string; affinity?: number; type?: string }
export interface EntityRef { id: string; name: string; type: string; affinity?: number; subtitle?: string }

// ---------- Taste profile ----------
export interface TasteProfile {
  tags: TagRef[];
  demographics: { band: string; value: number }[];
  genderSkew: string | null;
  affinities: { artists: EntityRef[]; films: EntityRef[]; brands: EntityRef[]; dining: EntityRef[] };
  heatmap: { lat: number; lng: number; v: number }[];
  hot: string[];
  evidence: Record<string, Evidence | null>;
  callCount: number;
  computedAt: number;
}

export interface Rival {
  id: string; // rival venue id
  name: string;
  slug: string;
  overlapScore: number;
  lat: number | null;
  lng: number | null;
  address: string | null;
  sharedTags: string[];
  evidence: Evidence | null;
}

// ---------- Users ----------
export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: "owner" | "manager" | "marketing";
  createdAt: number;
  notificationPrefs: { lostRequests: boolean; weeklyReport: boolean; runFinished: boolean };
}

export interface NotificationDoc {
  id: string;
  kind: "lost_request" | "run_finished" | "weekly" | "access_request";
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: number;
}

// ---------- Arena ----------
export const REASON_CODES = ["TASTE_GAP", "INFO_GAP", "PITCH_GAP", "CLOSED"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface Segment {
  id: string;
  name: string;
  tagIds: string[];
  tagNames: string[];
  weight: number;
  occasions: string[];
  seedPool: EntityRef[];
  evidence: Evidence | null;
}

export interface Persona {
  id: string;
  index: number;
  segmentId: string;
  segmentName: string;
  displayName: string;
  ageBand: string;
  occasion: string;
  budget: "$" | "$$" | "$$$";
  slot: { day: Day; time: string };
  partySize: number;
  seeds: EntityRef[];
  requestText: string;
}

export interface VenueReply {
  fits: boolean;
  availability: "open" | "closed" | "unknown";
  priceFit: "yes" | "no" | "unknown";
  pitch: string;
  factsUsed: string[];
  bookingLink: string | null;
}

export interface CandidateResult {
  venueId: string;
  name: string;
  isTarget: boolean;
  isProxy: boolean;
  affinity: number;
  normAffinity: number;
  C: number;
  Q: number;
  score: number;
  reply: VenueReply | null;
  asked: boolean;
}

export interface RoundDoc {
  id: string; // persona id
  index: number;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  lockedAt: number | null;
  persona: Persona;
  candidates: CandidateResult[];
  winnerVenueId: string | null;
  winnerName: string | null;
  targetWon: boolean;
  reason: string;
  reasonCodes: ReasonCode[];
  affinityEvidence: Evidence | null;
  createdAt: number;
  finishedAt: number | null;
}

export interface RunSummary {
  soav: number;
  wins: number;
  total: number;
  bySegment: { segmentId: string; name: string; n: number; wins: number }[];
  lostTo: { venueId: string; name: string; losses: number; mainReason: ReasonCode | null; topSegment: string | null }[];
  reasonCodes: Record<ReasonCode, number>;
  weights: { A: number; C: number; Q: number };
}

export interface RunDoc {
  id: string;
  venueId: string;
  venueName: string;
  ownerId: string | null;
  cardVersion: number;
  seed: number;
  number: number;
  personaCount: number;
  city: string;
  status: "queued" | "running" | "complete" | "failed";
  label: "baseline" | "what-if" | "weekly";
  parentRunId: string | null;
  progress: { done: number; total: number };
  isPublicDemo: boolean;
  candidateIds: string[];
  segments: Segment[];
  summary: RunSummary | null;
  analyst: { narrative: string; patterns: { code: ReasonCode; title: string; detail: string }[] } | null;
  appliedActionIds: string[];
  startedAt: number;
  finishedAt: number | null;
  lastTickAt: number | null;
  error?: string | null;
}

export interface MessageDoc {
  id: string;
  personaId: string;
  fromAgent: string;
  toAgent: string;
  direction: "request" | "response";
  method: string;
  payload: unknown;
  createdAt: number;
}

// ---------- Strategist ----------
export type ActionKind = "card_fact" | "pitch" | "event" | "menu" | "hours" | "collab";
export interface ActionDoc {
  id: string;
  runId: string;
  kind: ActionKind;
  title: string;
  detail: string;
  reasonCode: ReasonCode;
  segmentName: string | null;
  evidence: Evidence | null;
  evidenceLabel: string;
  status: "proposed" | "accepted" | "dismissed" | "applied";
  estLift: number;
  measuredLift: number | null;
  liftType: "measured" | "estimated";
  rank: number;
  patch: Partial<CardFacts> & { voice?: string };
  createdAt: number;
}

// ---------- Inbox ----------
export interface InboxDoc {
  id: string;
  protocol: "a2a" | "mcp";
  fromAgent: string;
  request: string;
  response: string;
  outcome: "recommended" | "top3" | "answered" | "unknown" | "lost";
  tool?: string;
  createdAt: number;
}

export interface QlooCallDoc {
  id: string;
  runId?: string | null;
  venueId?: string | null;
  path: string;
  params: Record<string, string>;
  ms: number;
  cached: boolean;
  status: number;
  resultCount: number;
  createdAt: number;
}

export interface ShareDoc { token: string; runId: string; venueId: string; createdBy: string; createdAt: number }
