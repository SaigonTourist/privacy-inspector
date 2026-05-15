import { SYSTEM_PROMPT, buildUserMessage } from "./prompt"
import type { AnalyzeRequest, AnalysisResult } from "../types"
import { AnalysisResultSchema } from "../types"

interface LLMEnv {
  GROQ_API_KEY: string
  GEMINI_API_KEY: string
}

async function callGroq(req: AnalyzeRequest, env: LLMEnv): Promise<AnalysisResult> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(req) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Groq ${res.status}: ${detail}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }
  const raw = JSON.parse(data.choices[0].message.content) as unknown
  const parsed = AnalysisResultSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("[Groq] Zod validation failed:", JSON.stringify(parsed.error.flatten()))
    console.error("[Groq] Raw response:", JSON.stringify(raw))
    throw new Error("Groq response failed schema validation")
  }
  return parsed.data
}

async function callGemini(req: AnalyzeRequest, env: LLMEnv): Promise<AnalysisResult> {
  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserMessage(req)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    }
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Gemini ${res.status}: ${detail}`)
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  const raw = JSON.parse(data.candidates[0].content.parts[0].text) as unknown
  const parsed = AnalysisResultSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("[Gemini] Zod validation failed:", JSON.stringify(parsed.error.flatten()))
    console.error("[Gemini] Raw response:", JSON.stringify(raw))
    throw new Error("Gemini response failed schema validation")
  }
  return parsed.data
}

export async function analyzeLLM(req: AnalyzeRequest, env: LLMEnv): Promise<AnalysisResult> {
  if (env.GROQ_API_KEY) {
    try {
      return await callGroq(req, env)
    } catch (err) {
      console.error("[LLM] Groq failed, falling back to Gemini:", err)
    }
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error("No LLM credentials configured")
  }

  return callGemini(req, env)
}
