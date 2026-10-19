// Turns a free text request into structured constraints. Used by venue agents for outside
// requests and by the public concierge. Pure code so it works without an LLM.
import type { Day } from "@/lib/types";

export interface Intent {
  day: Day | null;
  time: string | null;
  partySize: number | null;
  budget: "$" | "$$" | "$$$" | null;
  occasion: string | null;
  likes: string[];
  city: string | null;
}

const DAY_WORDS: [RegExp, Day][] = [
  [/\bmon(day)?\b/i, "mon"], [/\btue(s|sday)?\b/i, "tue"], [/\bwed(nesday)?\b/i, "wed"], [/\bthu(rs|rsday)?\b/i, "thu"],
  [/\bfri(day)?\b/i, "fri"], [/\bsat(urday)?\b/i, "sat"], [/\bsun(day)?\b/i, "sun"],
];
const JS_DAY: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, couple: 2 };

export function parseIntent(text: string, nowDate = new Date()): Intent {
  const t = text.toLowerCase();
  let day: Day | null = null;
  for (const [re, d] of DAY_WORDS) if (re.test(t)) day = d;
  if (!day && /\b(tonight|today|this evening)\b/.test(t)) day = JS_DAY[nowDate.getDay()];
  if (!day && /\btomorrow\b/.test(t)) day = JS_DAY[(nowDate.getDay() + 1) % 7];
  if (!day && /\bweekend\b/.test(t)) day = "sat";

  let time: string | null = null;
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] ?? "00";
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    time = `${String(h).padStart(2, "0")}:${min}`;
  } else if (/\bbrunch\b/.test(t)) time = "12:00";
  else if (/\bafter work\b/.test(t)) time = "18:00";
  else if (/\blate night|late\b/.test(t)) time = "23:30";
  else if (/\b(tonight|evening|dinner|drinks?)\b/.test(t)) time = "20:00";

  let partySize: number | null = null;
  const p = t.match(/\b(?:for|party of|group of|table for)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|ten|a couple)\b/);
  if (p) partySize = NUM_WORDS[p[1].replace("a ", "")] ?? Number(p[1]);
  else if (/\b(date|the two of us|my partner|girlfriend|boyfriend|wife|husband)\b/.test(t)) partySize = 2;
  else if (/\b(solo|alone|by myself|just me)\b/.test(t)) partySize = 1;

  let budget: Intent["budget"] = null;
  const dollars = t.match(/\${1,4}/);
  if (dollars) budget = (dollars[0].length >= 3 ? "$$$" : dollars[0]) as Intent["budget"];
  else if (/\b(cheap|budget|inexpensive|affordable)\b/.test(t)) budget = "$";
  else if (/\b(not too (pricey|expensive)|nothing too (pricey|expensive|fancy)|reasonable|mid range|moderate)\b/.test(t)) budget = "$$";
  else if (/\b(fancy|splurge|special occasion|upscale)\b/.test(t)) budget = "$$$";

  let occasion: string | null = null;
  if (/\bdate\b|romantic|anniversary/.test(t)) occasion = "date night";
  else if (/\bbrunch\b/.test(t)) occasion = "brunch";
  else if (/\blive music|jazz|band|gig|dj\b/.test(t)) occasion = "live music";
  else if (/\bafter work|happy hour\b/.test(t)) occasion = "after work";
  else if (/\bgroup|friends|birthday|team\b/.test(t)) occasion = "group dinner";
  else if (/\blate night\b/.test(t)) occasion = "late night";
  else if (/\bsolo|alone|quiet drink\b/.test(t)) occasion = "solo drink";

  const likes: string[] = [];
  const likeRe = /(?:into|love|loves|like|likes|fan of|fans of|listen to|vibe of|similar to)\s+([^.!?]+)/gi;
  let lm: RegExpExecArray | null;
  while ((lm = likeRe.exec(text))) {
    lm[1]
      .split(/,| and | or |\bplus\b/)
      .map((s) => s.replace(/\b(we're|we are|i'm|i am|music|stuff|things|nothing too pricey|but|please)\b/gi, "").trim())
      .filter((s) => s.length > 1 && s.length < 40)
      .forEach((s) => likes.push(s));
  }

  let city: string | null = null;
  const cm = text.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  if (cm) city = cm[1];

  return { day, time, partySize, budget, occasion, likes: [...new Set(likes)].slice(0, 5), city };
}
