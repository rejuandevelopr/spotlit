// A small, deterministic taste world used in mock mode (SPOTLIT_MOCK=1).
// Responses produced from it follow the real Qloo response shapes, so every parser and
// engine path runs exactly as it does against the live API. Place names are fictional.

// Taste dimensions: vinyl, wine, date, jazz, dj, brunch
export type Vec = [number, number, number, number, number, number];

export interface MockTag { id: string; name: string; type: string; v: Vec }
export interface MockEntity {
  id: string;
  name: string;
  kind: "artist" | "movie" | "brand" | "place";
  v: Vec;
  props?: Record<string, unknown>;
  lat?: number;
  lng?: number;
  tagNames?: string[];
  popularity?: number;
}

const t = (slug: string, name: string, type: string, v: Vec): MockTag => ({
  id: `urn:tag:${type}:qloo:${slug}`,
  name,
  type: `urn:tag:${type}:qloo`,
  v,
});

export const TAGS: MockTag[] = [
  t("vinyl_listening", "Vinyl listening", "keyword", [1, 0.1, 0.3, 0.3, 0.2, 0]),
  t("record_collecting", "Record collecting", "keyword", [0.9, 0, 0.1, 0.3, 0.2, 0]),
  t("hi_fi_sound", "Hi fi sound", "keyword", [0.8, 0.1, 0.2, 0.4, 0.1, 0]),
  t("listening_bar", "Listening bar", "category", [0.9, 0.4, 0.4, 0.3, 0.1, 0]),
  t("psych_soul", "Psych soul", "genre", [0.6, 0.1, 0.3, 0.4, 0.1, 0]),
  t("city_pop", "City pop", "genre", [0.7, 0.1, 0.4, 0.1, 0.1, 0]),
  t("ambient", "Ambient", "genre", [0.5, 0.1, 0.3, 0.2, 0.2, 0]),
  t("neo_jazz", "Neo jazz", "genre", [0.3, 0.1, 0.2, 0.9, 0.1, 0]),
  t("spiritual_jazz", "Spiritual jazz", "genre", [0.3, 0, 0.1, 1, 0, 0]),
  t("live_jazz", "Live jazz", "keyword", [0.1, 0.1, 0.2, 1, 0, 0.1]),
  t("soul", "Soul", "genre", [0.5, 0.1, 0.3, 0.6, 0.1, 0.1]),
  t("natural_wine", "Natural wine", "keyword", [0.2, 1, 0.3, 0, 0, 0.1]),
  t("orange_wine", "Orange wine", "keyword", [0.1, 0.9, 0.2, 0, 0, 0]),
  t("low_abv", "Low ABV", "keyword", [0.1, 0.5, 0.3, 0, 0, 0.3]),
  t("small_plates", "Small plates", "cuisine", [0.1, 0.5, 0.5, 0.1, 0, 0.2]),
  t("wine_bar", "Wine bar", "category", [0.1, 1, 0.4, 0.1, 0, 0]),
  t("date_night", "Date night", "keyword", [0.2, 0.3, 1, 0.2, 0, 0]),
  t("dim_lighting", "Dim lighting", "keyword", [0.3, 0.2, 0.8, 0.2, 0.1, 0]),
  t("cozy", "Cozy", "keyword", [0.2, 0.2, 0.6, 0.1, 0, 0.3]),
  t("romantic", "Romantic", "keyword", [0.1, 0.3, 0.9, 0.1, 0, 0]),
  t("craft_cocktails", "Craft cocktails", "keyword", [0, 0.2, 0.5, 0.2, 0.3, 0]),
  t("indie_rock", "Indie rock", "genre", [0.4, 0.1, 0.5, 0, 0.1, 0.1]),
  t("dj_sets", "DJ sets", "keyword", [0.2, 0, 0.1, 0, 1, 0]),
  t("house_music", "House music", "genre", [0.1, 0, 0.1, 0, 0.9, 0]),
  t("techno", "Techno", "genre", [0, 0, 0, 0, 1, 0]),
  t("dance_floor", "Dance floor", "keyword", [0, 0, 0.1, 0, 0.9, 0.1]),
  t("late_night", "Late night", "keyword", [0.2, 0.1, 0.1, 0, 0.7, 0]),
  t("hip_hop", "Hip hop", "genre", [0.1, 0, 0.1, 0.1, 0.6, 0.1]),
  t("brunch", "Brunch", "keyword", [0, 0.1, 0.1, 0, 0, 1]),
  t("bottomless_mimosas", "Bottomless mimosas", "keyword", [0, 0.2, 0, 0, 0.1, 0.9]),
  t("specialty_coffee", "Specialty coffee", "keyword", [0.1, 0, 0.1, 0, 0, 0.6]),
  t("outdoor_seating", "Outdoor seating", "keyword", [0, 0.2, 0.1, 0, 0, 0.6]),
  t("group_friendly", "Group friendly", "keyword", [0, 0.1, 0, 0, 0.4, 0.6]),
  t("izakaya", "Izakaya", "cuisine", [0.2, 0.3, 0.4, 0.1, 0.1, 0.1]),
  t("omakase", "Omakase", "cuisine", [0, 0.3, 0.6, 0, 0, 0]),
  t("neighborhood_bar", "Neighborhood bar", "category", [0.2, 0.3, 0.2, 0.1, 0.3, 0.3]),
  t("music_venue", "Music venue", "category", [0.3, 0, 0.1, 0.6, 0.5, 0]),
  t("dive_bar", "Dive bar", "category", [0.2, 0, 0, 0, 0.4, 0.1]),
];

const e = (
  kind: MockEntity["kind"],
  slug: string,
  name: string,
  v: Vec,
  extra: Partial<MockEntity> = {},
): MockEntity => ({ id: `mock-${kind}-${slug}`, name, kind, v, ...extra });

export const ENTITIES: MockEntity[] = [
  // Artists
  e("artist", "khruangbin", "Khruangbin", [0.8, 0.2, 0.5, 0.3, 0.1, 0.1]),
  e("artist", "mildlife", "Mildlife", [0.8, 0.1, 0.3, 0.4, 0.2, 0]),
  e("artist", "tatsuro", "Tatsuro Yamashita", [0.9, 0.1, 0.4, 0.1, 0.1, 0]),
  e("artist", "mariya", "Mariya Takeuchi", [0.8, 0.1, 0.5, 0.1, 0, 0.1]),
  e("artist", "alice_coltrane", "Alice Coltrane", [0.4, 0, 0.1, 1, 0, 0]),
  e("artist", "pharoah", "Pharoah Sanders", [0.3, 0, 0.1, 0.9, 0, 0]),
  e("artist", "kamasi", "Kamasi Washington", [0.3, 0, 0.1, 0.9, 0.1, 0]),
  e("artist", "thundercat", "Thundercat", [0.4, 0, 0.2, 0.6, 0.3, 0.1]),
  e("artist", "erykah", "Erykah Badu", [0.4, 0.1, 0.5, 0.5, 0.1, 0.1]),
  e("artist", "floating_points", "Floating Points", [0.5, 0, 0.1, 0.4, 0.6, 0]),
  e("artist", "four_tet", "Four Tet", [0.3, 0, 0.1, 0.1, 0.8, 0]),
  e("artist", "fred_again", "Fred again..", [0.1, 0, 0.1, 0, 1, 0.1]),
  e("artist", "kaytranada", "Kaytranada", [0.1, 0, 0.3, 0.1, 0.8, 0.1]),
  e("artist", "charli", "Charli xcx", [0, 0, 0.1, 0, 0.9, 0.3]),
  e("artist", "mac_demarco", "Mac DeMarco", [0.4, 0.1, 0.6, 0, 0.1, 0.1]),
  e("artist", "big_thief", "Big Thief", [0.3, 0.2, 0.7, 0, 0, 0.1]),
  e("artist", "phoebe", "Phoebe Bridgers", [0.2, 0.2, 0.8, 0, 0, 0.1]),
  e("artist", "norah_jones", "Norah Jones", [0.2, 0.45, 0.45, 0.5, 0, 0.3]),
  e("artist", "vulfpeck", "Vulfpeck", [0.2, 0, 0.1, 0.5, 0.1, 0.5]),
  e("artist", "anderson_paak", "Anderson .Paak", [0.1, 0, 0.2, 0.3, 0.5, 0.4]),
  e("artist", "lizzo", "Lizzo", [0, 0.1, 0.1, 0.1, 0.4, 0.7]),
  e("artist", "harry_styles", "Harry Styles", [0, 0.1, 0.3, 0, 0.2, 0.7]),
  e("artist", "bonobo", "Bonobo", [0.4, 0.2, 0.3, 0.1, 0.5, 0.1]),
  // Films
  e("movie", "mood_for_love", "In the Mood for Love", [0.5, 0.35, 0.7, 0.2, 0, 0]),
  e("movie", "paterson", "Paterson", [0.65, 0.25, 0.3, 0.1, 0, 0.1]),
  e("movie", "lost_in_translation", "Lost in Translation", [0.55, 0.2, 0.6, 0, 0.1, 0]),
  e("movie", "before_sunrise", "Before Sunrise", [0.25, 0.5, 0.7, 0, 0, 0.1]),
  e("movie", "paris_texas", "Paris, Texas", [0.6, 0.1, 0.4, 0.1, 0, 0]),
  e("movie", "whiplash", "Whiplash", [0.1, 0, 0.1, 1, 0, 0]),
  e("movie", "la_la_land", "La La Land", [0.1, 0.1, 0.7, 0.7, 0, 0.2]),
  e("movie", "soul", "Soul", [0.1, 0, 0.2, 0.8, 0, 0.4]),
  e("movie", "frances_ha", "Frances Ha", [0.3, 0.55, 0.4, 0, 0.1, 0.3]),
  e("movie", "sideways", "Sideways", [0, 1, 0.3, 0, 0, 0.1]),
  e("movie", "somm", "Somm", [0, 1, 0.1, 0, 0, 0]),
  e("movie", "human_traffic", "Human Traffic", [0, 0, 0.1, 0, 1, 0]),
  e("movie", "party_people", "24 Hour Party People", [0.4, 0, 0, 0, 0.8, 0]),
  e("movie", "chef", "Chef", [0, 0.3, 0.1, 0, 0, 0.7]),
  e("movie", "bridesmaids", "Bridesmaids", [0, 0.2, 0.1, 0, 0.2, 0.8]),
  // Brands
  e("brand", "aesop", "Aesop", [0.3, 0.5, 0.6, 0.1, 0, 0.1]),
  e("brand", "kinfolk", "Kinfolk", [0.2, 0.5, 0.5, 0, 0, 0.3]),
  e("brand", "teenage_engineering", "Teenage Engineering", [0.9, 0, 0.1, 0.1, 0.3, 0]),
  e("brand", "le_labo", "Le Labo", [0.1, 0.4, 0.7, 0, 0, 0.1]),
  e("brand", "rough_trade", "Rough Trade", [1, 0, 0.1, 0.2, 0.2, 0]),
  e("brand", "blue_note", "Blue Note Records", [0.4, 0, 0.1, 1, 0, 0]),
  e("brand", "bowers_wilkins", "Bowers and Wilkins", [0.7, 0.1, 0.2, 0.4, 0, 0]),
  e("brand", "carhartt_wip", "Carhartt WIP", [0.4, 0, 0, 0, 0.7, 0.1]),
  e("brand", "stussy", "Stussy", [0.1, 0, 0, 0, 0.8, 0.2]),
  e("brand", "glossier", "Glossier", [0, 0.1, 0.3, 0, 0, 0.7]),
  e("brand", "sweetgreen", "Sweetgreen", [0, 0.1, 0, 0, 0, 0.8]),
  e("brand", "aperol", "Aperol", [0, 0.4, 0.2, 0, 0.1, 0.6]),
  e("brand", "ace_hotel", "Ace Hotel", [0.4, 0.3, 0.4, 0.1, 0.3, 0.2]),
  // Dining (places used as "your crowd also loves" dining categories)
  e("place", "izakaya_rintaro", "Izakaya counters", [0.2, 0.3, 0.6, 0.1, 0.1, 0.1], { props: { kindLabel: "dining" } }),
  e("place", "nat_wine_bars", "Natural wine bars", [0.2, 1, 0.4, 0, 0, 0.1], { props: { kindLabel: "dining" } }),
  e("place", "omakase_counters", "Omakase counters", [0, 0.3, 0.7, 0, 0, 0], { props: { kindLabel: "dining" } }),
  e("place", "taquerias", "Late night taquerias", [0, 0, 0, 0, 0.8, 0.2], { props: { kindLabel: "dining" } }),
  e("place", "bakeries", "Neighborhood bakeries", [0, 0.1, 0.1, 0, 0, 0.9], { props: { kindLabel: "dining" } }),
];

const H = (o: string, c: string) => [{ opens: `${o}:00`, closes: `${c}:00` }];
const week = (m: Record<string, ReturnType<typeof H> | undefined>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) if (v) out[k] = v;
  return out;
};

const place = (
  slug: string,
  name: string,
  v: Vec,
  lat: number,
  lng: number,
  address: string,
  neighborhood: string,
  tagNames: string[],
  props: Record<string, unknown> = {},
  popularity = 0.7,
): MockEntity => ({
  id: `mock-place-${slug}`,
  name,
  kind: "place",
  v,
  lat,
  lng,
  tagNames,
  popularity,
  props: { address, neighborhood, ...props },
});

export const PLACES: MockEntity[] = [
  place("side_b", "Side B Wine Bar", [0.1, 1, 0.45, 0, 0, 0.25], 40.7146, -73.9566, "214 Bedford Ave, Brooklyn, NY", "Williamsburg",
    ["Natural wine", "Wine bar", "Small plates", "Date night", "Orange wine", "Cozy"],
    { price_level: 2, website: "https://example.com/side-b", hours: week({ Monday: H("17", "23"), Tuesday: H("17", "23"), Wednesday: H("17", "23"), Thursday: H("17", "24"), Friday: H("16", "01"), Saturday: H("14", "01"), Sunday: H("14", "22") }) }, 0.82),
  place("groove_room", "Groove Room", [0.5, 0.1, 0.3, 1, 0.2, 0], 40.7182, -73.9581, "88 N 6th St, Brooklyn, NY", "Williamsburg",
    ["Live jazz", "Neo jazz", "Soul", "Craft cocktails", "Music venue"],
    { price_level: 2, hours: week({ Wednesday: H("18", "01"), Thursday: H("18", "01"), Friday: H("18", "02"), Saturday: H("18", "02") }) }, 0.76),
  place("low_fidelity", "Low Fidelity", [0.2, 0.1, 0.75, 0.1, 0.55, 0], 40.7111, -73.9617, "312 Grand St, Brooklyn, NY", "Williamsburg",
    ["Vinyl listening", "Date night", "Dim lighting", "Craft cocktails", "City pop"],
    { price_level: 3 }, 0.68),
  place("cassette_club", "Cassette Club", [0.6, 0, 0.2, 0.1, 0.8, 0], 40.7069, -73.9229, "1050 Flushing Ave, Brooklyn, NY", "Bushwick",
    ["DJ sets", "Record collecting", "House music", "Late night", "Dance floor"],
    { price_level: 2, hours: week({ Thursday: H("21", "04"), Friday: H("21", "04"), Saturday: H("21", "04") }) }, 0.71),
  place("night_shift", "Night Shift Wine", [0.2, 0.8, 0.3, 0, 0.4, 0], 40.7243, -73.9512, "65 Nassau Ave, Brooklyn, NY", "Greenpoint",
    ["Natural wine", "Late night", "Low ABV", "Neighborhood bar"],
    { price_level: 2, hours: week({ Tuesday: H("18", "02"), Wednesday: H("18", "02"), Thursday: H("18", "02"), Friday: H("18", "03"), Saturday: H("18", "03"), Sunday: H("12", "20") }) }, 0.63),
  place("needle_drop", "The Needle Drop", [1, 0, 0.15, 0.6, 0.35, 0], 40.7158, -73.9441, "29 Graham Ave, Brooklyn, NY", "Williamsburg",
    ["Vinyl listening", "Hi fi sound", "Record collecting", "Psych soul", "Listening bar"],
    { price_level: 2 }, 0.66),
  place("sunday_service", "Sunday Service Cafe", [0, 0.1, 0.1, 0, 0, 1], 40.6782, -73.9787, "201 5th Ave, Brooklyn, NY", "Park Slope",
    ["Brunch", "Bottomless mimosas", "Specialty coffee", "Outdoor seating", "Group friendly"],
    { price_level: 2, hours: week({ Saturday: H("09", "16"), Sunday: H("09", "16"), Friday: H("08", "15") }) }, 0.74),
  place("pulse", "Pulse Warehouse", [0, 0, 0, 0, 1, 0], 40.7051, -73.9325, "140 Morgan Ave, Brooklyn, NY", "Bushwick",
    ["Techno", "Dance floor", "Late night", "DJ sets"],
    { price_level: 2, hours: week({ Friday: H("22", "06"), Saturday: H("22", "06") }) }, 0.69),
  place("side_room", "Side Room", [0.15, 0.9, 0.3, 0.1, 0.1, 0.35], 40.7298, -73.9551, "112 Franklin St, Brooklyn, NY", "Greenpoint",
    ["Wine bar", "Natural wine", "Small plates"],
    { price_level: 2 }, 0.52),
  place("copper_fox", "Copper Fox", [0.1, 0.2, 0.7, 0.2, 0.4, 0], 40.7132, -73.9599, "77 Berry St, Brooklyn, NY", "Williamsburg",
    ["Craft cocktails", "Date night", "Dim lighting"],
    { price_level: 3, hours: week({ Monday: H("17", "01"), Tuesday: H("17", "01"), Wednesday: H("17", "01"), Thursday: H("17", "02"), Friday: H("17", "02"), Saturday: H("17", "02"), Sunday: H("17", "24") }) }, 0.6),
  place("blue_lantern", "Blue Lantern Jazz Club", [0.2, 0.1, 0.4, 1, 0, 0.1], 40.6862, -73.9776, "410 Atlantic Ave, Brooklyn, NY", "Boerum Hill",
    ["Live jazz", "Spiritual jazz", "Romantic"],
    { price_level: 3 }, 0.58),
  place("fern_brunch", "Fern and Flour", [0, 0.2, 0.2, 0, 0, 0.9], 40.7201, -73.9601, "15 Wythe Ave, Brooklyn, NY", "Williamsburg",
    ["Brunch", "Outdoor seating", "Specialty coffee", "Group friendly"],
    { price_level: 2, hours: week({ Saturday: H("10", "16"), Sunday: H("10", "16") }) }, 0.65),
  place("harbor_hifi", "Harbor Hi Fi", [0.8, 0.1, 0.2, 0.8, 0.1, 0], 40.7419, -73.9897, "18 W 23rd St, New York, NY", "Flatiron",
    ["Hi fi sound", "Vinyl listening", "Neo jazz"],
    { price_level: 3 }, 0.62),
  place("velvet_hours", "Velvet Hours", [0.2, 0.5, 0.9, 0.1, 0.1, 0], 40.7265, -73.9839, "120 E 7th St, New York, NY", "East Village",
    ["Romantic", "Natural wine", "Dim lighting", "Date night"],
    { price_level: 3 }, 0.6),
];

export const NEIGHBORHOODS: { name: string; lat: number; lng: number; v: Vec }[] = [
  { name: "Williamsburg", lat: 40.7128, lng: -73.957, v: [0.8, 0.7, 0.6, 0.3, 0.5, 0.2] },
  { name: "Greenpoint", lat: 40.7295, lng: -73.9536, v: [0.6, 0.8, 0.5, 0.2, 0.2, 0.3] },
  { name: "Bushwick", lat: 40.6995, lng: -73.9282, v: [0.6, 0.3, 0.3, 0.1, 1, 0.1] },
  { name: "Fort Greene", lat: 40.6893, lng: -73.9747, v: [0.3, 0.3, 0.5, 0.8, 0.1, 0.3] },
  { name: "Park Slope", lat: 40.6721, lng: -73.9785, v: [0.1, 0.3, 0.3, 0.1, 0, 1] },
  { name: "Bed Stuy", lat: 40.6862, lng: -73.9443, v: [0.4, 0.2, 0.3, 0.6, 0.5, 0.3] },
];

/** The city taste baseline used for location only signals. */
export const CITY_BASE: Vec = [0.55, 0.6, 0.55, 0.45, 0.5, 0.5];

export const NYC_RE = /new york|nyc|brooklyn|manhattan|williamsburg|greenpoint|bushwick|queens|park slope|fort greene/i;
