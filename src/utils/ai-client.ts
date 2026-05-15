import type { DetectedTracker } from "../types/tracker"

// Set via PLASMO_PUBLIC_ANALYZE_URL in .env
const ANALYZE_URL: string = process.env.PLASMO_PUBLIC_ANALYZE_URL ?? ""

export interface Violation {
  tracker_domain: string
  company: string
  article: string
  severity: "low" | "medium" | "high" | "critical"
  explanation: string
}

export interface AnalysisResponse {
  risk_score: number
  primary_law: "GDPR" | "CCPA" | "LGPD"
  risk_level: "low" | "medium" | "high" | "critical"
  violations: Violation[]
  overall_assessment: string
  recommended_action: string
  claim_letter?: string | null
  disclaimer: string
  cached: boolean
}

export async function analyzeTrackers(
  site: string,
  trackers: DetectedTracker[]
): Promise<AnalysisResponse> {
  if (!ANALYZE_URL) throw new Error("PLASMO_PUBLIC_ANALYZE_URL no configurada")

  const lang = (navigator.language || "es").slice(0, 2) || "es"

  const res = await fetch(`${ANALYZE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      site: site || "unknown",
      trackers: trackers.map((t) => ({
        domain:             t.domain,
        company:            t.company,
        category:           t.category,
        risk:               t.risk,
        gdpr_articles:      t.gdpr_articles ?? [],
        data_collected:     { human: t.data_collected?.human ?? [] },
        what_they_do_human: t.what_they_do_human ?? "",
      })),
      user_lang: lang,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string; details?: unknown } | null
    const msg  = body?.error ?? `HTTP ${res.status}`
    console.error("[AI] Request rejected:", body)
    throw new Error(msg)
  }

  return res.json() as Promise<AnalysisResponse>
}
