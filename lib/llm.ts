import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { env, hasLLM } from "@/lib/env";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { limiter, sha256 } from "@/lib/util";

export type Tier = "fast" | "smart";

const google = createGoogleGenerativeAI({ apiKey: env.geminiKey });
export const model = (tier: Tier) => google(tier === "fast" ? env.modelFast : env.modelSmart);

const limit = limiter(Math.max(1, env.llmConcurrency));

interface Common { tier: Tier; system: string; prompt: string; cache?: boolean; temperature?: number }

async function cached<T>(key: string | null, fn: () => Promise<T>): Promise<T> {
  if (!key) return fn();
  const hit = await db().get<{ json: string }>(P.llmCache(key)).catch(() => null);
  if (hit) return JSON.parse(hit.json) as T;
  const out = await fn();
  await db().set(P.llmCache(key), { json: JSON.stringify(out), createdAt: Date.now() }).catch(() => undefined);
  return out;
}

/**
 * Structured output with zod validation. Retries once, then returns null so callers can
 * fall back to deterministic code. Returns null right away when no LLM is configured.
 */
export async function llmObject<S extends z.ZodTypeAny>(opts: Common & { schema: S }): Promise<z.infer<S> | null> {
  if (!hasLLM()) return null;
  const key = opts.cache ? sha256(`obj|${opts.tier}|${opts.system}|${opts.prompt}`) : null;
  try {
    return await cached(key, async () => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { object } = await limit(() =>
            generateObject({
              model: model(opts.tier),
              schema: opts.schema,
              system: opts.system,
              prompt: opts.prompt,
              temperature: opts.temperature ?? 0.4,
              maxRetries: 2,
            }),
          );
          return object as z.infer<S>;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr;
    });
  } catch (err) {
    console.warn("[llm] object generation failed, using fallback:", (err as Error)?.message?.slice(0, 200));
    return null;
  }
}

export async function llmText(opts: Common): Promise<string | null> {
  if (!hasLLM()) return null;
  const key = opts.cache ? sha256(`txt|${opts.tier}|${opts.system}|${opts.prompt}`) : null;
  try {
    return await cached(key, async () => {
      const { text } = await limit(() =>
        generateText({ model: model(opts.tier), system: opts.system, prompt: opts.prompt, temperature: opts.temperature ?? 0.5, maxRetries: 2 }),
      );
      return text.trim();
    });
  } catch (err) {
    console.warn("[llm] text generation failed, using fallback:", (err as Error)?.message?.slice(0, 200));
    return null;
  }
}
