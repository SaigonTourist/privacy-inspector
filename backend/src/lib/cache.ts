import { Redis } from "@upstash/redis"
import type { AnalysisResult } from "../types"

const CACHE_TTL = 60 * 60 * 24 // 24 hours

interface CacheEnv {
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
}

function makeRedis(env: CacheEnv): Redis {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export async function getCached(env: CacheEnv, site: string): Promise<AnalysisResult | null> {
  try {
    const redis = makeRedis(env)
    return await redis.get<AnalysisResult>(`analysis:${site}`)
  } catch {
    return null
  }
}

export async function setCached(
  env: CacheEnv,
  site: string,
  result: AnalysisResult
): Promise<void> {
  const redis = makeRedis(env)
  await redis.set(`analysis:${site}`, result, { ex: CACHE_TTL })
}
