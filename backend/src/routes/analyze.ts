import { Hono } from "hono"
import { AnalyzeRequestSchema } from "../types"
import { getCached, setCached } from "../lib/cache"
import { analyzeLLM } from "../lib/llm"

type Bindings = {
  GROQ_API_KEY: string
  GEMINI_API_KEY: string
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
}

const DISCLAIMER = "Este análisis es orientativo y no constituye asesoramiento jurídico."

const analyze = new Hono<{ Bindings: Bindings }>()

analyze.post("/", async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON" }, 400)
  }

  const parsed = AnalyzeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400)
  }

  const req = parsed.data

  const cached = await getCached(c.env, req.site)
  if (cached) {
    return c.json({ ...cached, disclaimer: DISCLAIMER, cached: true })
  }

  let result
  try {
    result = await analyzeLLM(req, c.env)
  } catch (err) {
    console.error("[analyze] LLM error:", err)
    return c.json({ error: "Analysis failed. Please try again." }, 502)
  }

  try {
    c.executionCtx.waitUntil(setCached(c.env, req.site, result))
  } catch {
    // executionCtx not available in some environments — non-fatal
  }

  return c.json({ ...result, disclaimer: DISCLAIMER, cached: false })
})

export default analyze
