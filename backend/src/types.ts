import { z } from "zod"

export const TrackerInputSchema = z.object({
  domain:             z.string(),
  company:            z.string(),
  category:           z.string(),
  risk:               z.number(),
  gdpr_articles:      z.array(z.string()).default([]),
  data_collected:     z.object({ human: z.array(z.string()).default([]) }),
  what_they_do_human: z.string().default(""),
})

export const AnalyzeRequestSchema = z.object({
  site:      z.string().min(1).max(253),
  trackers:  z.array(TrackerInputSchema).min(1).max(50),
  user_lang: z.string().min(1).optional().default("es"),
})

const severityEnum = z.string().transform((s) => s.toLowerCase()).pipe(
  z.enum(["low", "medium", "high", "critical"])
)

const primaryLawEnum = z.string().transform((s) => s.toUpperCase()).pipe(
  z.enum(["GDPR", "CCPA", "LGPD"])
)

export const ViolationSchema = z.object({
  tracker_domain: z.string(),
  company: z.string(),
  article: z.string(),
  severity: severityEnum,
  explanation: z.string(),
})

export const AnalysisResultSchema = z.object({
  risk_score: z.number().transform((n) => Math.min(100, Math.max(0, Math.round(n)))),
  primary_law: primaryLawEnum,
  risk_level: severityEnum,
  violations: z.array(ViolationSchema),
  overall_assessment: z.string(),
  recommended_action: z.string(),
  claim_letter: z.string().nullable().optional(),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>
