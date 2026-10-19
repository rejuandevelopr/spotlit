// Deterministic persona factory. Same seed and segments always give the same personas.
import { allocate, mulberry32, pick, weightedSample, type Rand } from "@/lib/rng";
import type { Day, EntityRef, Persona, Segment } from "@/lib/types";

const FIRST_NAMES = [
  "Maya", "Theo", "Ana", "Jules", "Sam", "Priya", "Noah", "Lena", "Omar", "Iris", "Kai", "Zoe", "Ravi", "Mila", "Eli",
  "Nina", "Leo", "Ada", "Marco", "June", "Tariq", "Hana", "Felix", "Rosa", "Dev", "Ines", "Owen", "Yara", "Luca", "Tess",
  "Amir", "Cleo", "Jonah", "Sofia", "Malik", "Elsa", "Kenji", "Lucia", "Ben", "Aisha", "Hugo", "Nadia", "Finn", "Vera",
  "Reza", "Gemma", "Ilan", "Maren", "Diego", "Lola", "Wes", "Anya", "Cyrus", "Freya", "Tomas", "Lin", "Arlo", "Nell",
];

const AGE_BANDS: { band: string; lo: number; hi: number }[] = [
  { band: "21 to 24", lo: 21, hi: 24 },
  { band: "25 to 29", lo: 25, hi: 29 },
  { band: "30 to 34", lo: 30, hi: 34 },
  { band: "35 to 44", lo: 35, hi: 44 },
  { band: "45 plus", lo: 45, hi: 58 },
];

export const OCCASIONS = ["date night", "group dinner", "solo drink", "live music", "after work", "brunch", "late night"] as const;

const SLOTS: Record<string, { days: Day[]; times: string[] }> = {
  "date night": { days: ["thu", "fri", "sat"], times: ["19:30", "20:00", "21:00"] },
  "group dinner": { days: ["thu", "fri", "sat"], times: ["19:00", "20:00", "20:30"] },
  "solo drink": { days: ["mon", "tue", "wed", "thu"], times: ["18:30", "20:00", "21:30"] },
  "live music": { days: ["thu", "fri", "sat"], times: ["21:00", "22:00"] },
  "after work": { days: ["tue", "wed", "thu", "fri"], times: ["17:30", "18:00", "18:30"] },
  brunch: { days: ["sat", "sun"], times: ["11:00", "12:00", "13:00"] },
  "late night": { days: ["fri", "sat"], times: ["23:30", "00:30"] },
};

const AGE_WEIGHTS: Record<string, number[]> = {
  vinyl: [1, 3, 3, 1.5, 0.5],
  wine: [0.6, 3, 3, 2, 0.8],
  date: [1, 3.5, 2.5, 1, 0.4],
  jazz: [0.4, 1.5, 2.5, 3, 1.5],
  dj: [3, 3, 1, 0.4, 0.1],
  brunch: [1, 2.5, 2.5, 2, 1],
};

function partyFor(r: Rand, occasion: string) {
  if (occasion === "date night") return 2;
  if (occasion === "solo drink") return 1;
  if (occasion === "group dinner" || occasion === "brunch") return 3 + Math.floor(r() * 4);
  return 1 + Math.floor(r() * 4);
}

function budgetFor(r: Rand, ageIdx: number): Persona["budget"] {
  const x = r() + ageIdx * 0.08;
  return x < 0.25 ? "$" : x < 0.8 ? "$$" : "$$$";
}

function pickSeeds(r: Rand, pool: EntityRef[]): EntityRef[] {
  const artists = pool.filter((p) => p.type === "artist");
  const movies = pool.filter((p) => p.type === "movie");
  const brands = pool.filter((p) => p.type === "brand");
  const w = (e: EntityRef) => (e.affinity ?? 0.5) + 0.05;
  const seeds = [
    ...weightedSample(r, artists, w, r() < 0.5 ? 2 : 1),
    ...weightedSample(r, movies, w, 1),
    ...weightedSample(r, brands, w, r() < 0.6 ? 1 : 0),
  ];
  if (seeds.length < 3) seeds.push(...weightedSample(r, pool.filter((p) => !seeds.includes(p)), w, 3 - seeds.length));
  return seeds.slice(0, 5);
}

/** Real people have mixed tastes: most personas get one seed from another segment. */
function withCrossover(r: Rand, seeds: EntityRef[], segments: Segment[], own: number): EntityRef[] {
  if (segments.length < 2 || r() > 0.65) return seeds;
  const others = segments.filter((_, i) => i !== own);
  const other = others[Math.floor(r() * others.length)];
  const extra = weightedSample(r, other.seedPool.filter((p) => !seeds.some((s) => s.id === p.id)), (e) => (e.affinity ?? 0.5) + 0.05, 1);
  return [...seeds.slice(0, 4), ...extra];
}

export function buildPersonas(seed: number, segments: Segment[], count: number): Persona[] {
  const r = mulberry32(seed);
  const counts = allocate(count, segments.map((s) => s.weight), 1);
  const names = [...FIRST_NAMES];
  const personas: Persona[] = [];
  let index = 0;
  segments.forEach((seg, si) => {
    for (let k = 0; k < counts[si]; k++) {
      const ageW = AGE_WEIGHTS[seg.id] ?? [1, 2, 2, 1.5, 0.8];
      const ageIdx = weightedSample(r, [0, 1, 2, 3, 4], (i) => ageW[i], 1)[0];
      const band = AGE_BANDS[ageIdx];
      const occasion = seg.occasions.length && r() < 0.8 ? pick(r, seg.occasions) : pick(r, OCCASIONS);
      const slotDef = SLOTS[occasion] ?? SLOTS["after work"];
      const nameIdx = Math.floor(r() * names.length);
      const name = names.splice(nameIdx, 1)[0] ?? `Guest ${index + 1}`;
      if (!names.length) names.push(...FIRST_NAMES);
      const age = band.lo + Math.floor(r() * (band.hi - band.lo + 1));
      personas.push({
        id: `p${String(index + 1).padStart(3, "0")}`,
        index,
        segmentId: seg.id,
        segmentName: seg.name,
        displayName: `${name}, ${age}`,
        ageBand: band.band,
        occasion,
        budget: budgetFor(r, ageIdx),
        slot: { day: pick(r, slotDef.days), time: pick(r, slotDef.times) },
        partySize: partyFor(r, occasion),
        seeds: withCrossover(r, pickSeeds(r, seg.seedPool), segments, si),
        requestText: "",
      });
      index++;
    }
  });
  return personas;
}
