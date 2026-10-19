// Central place for reading environment variables. Safe to import on server and client
// (only NEXT_PUBLIC_ values are read on the client).

const truthy = (v: string | undefined) => v === "1" || v === "true" || v === "yes";

export const env = {
  mock: truthy(process.env.SPOTLIT_MOCK) || truthy(process.env.NEXT_PUBLIC_SPOTLIT_MOCK),
  publicMock: truthy(process.env.NEXT_PUBLIC_SPOTLIT_MOCK),
  demoMode: truthy(process.env.DEMO_MODE),
  qlooKey: process.env.QLOO_API_KEY ?? "",
  qlooBase: (process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com").replace(/\/$/, ""),
  geminiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
  modelFast: process.env.MODEL_FAST || "gemini-3.1-flash-lite",
  modelSmart: process.env.MODEL_SMART || "gemini-3-flash-preview",
  llmConcurrency: Number(process.env.LLM_CONCURRENCY || 4),
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  internalSecret: process.env.INTERNAL_TASK_SECRET || "",
  demoCity: process.env.DEMO_CITY || "New York",
  demoSlug: process.env.DEMO_VENUE_SLUG || "halftone-house",
  maxPersonasPublic: Number(process.env.ARENA_MAX_PERSONAS_PUBLIC || 24),
  maxPersonasDemo: Number(process.env.ARENA_MAX_PERSONAS_DEMO || 60),
  sessionDays: Number(process.env.SESSION_COOKIE_DAYS || 14),
  a2aInProcess: truthy(process.env.A2A_INPROCESS),
  /** LLM use inside arena runs: all (default), concierge (persona + venue replies use templates), off. */
  arenaLlm: (process.env.ARENA_LLM || "all") as "all" | "concierge" | "off",
};

export const isMock = () => env.mock;
export const hasLLM = () => !env.mock && !!env.geminiKey;
export const hasQloo = () => !env.mock && !!env.qlooKey;
