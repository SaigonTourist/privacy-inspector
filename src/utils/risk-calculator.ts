import type { DetectedTracker } from "../types/tracker"

export function calcPageRisk(trackers: DetectedTracker[]): number {
  if (trackers.length === 0) return 0

  // Base: average of the top-3 individual risks
  const top3 = trackers
    .map((t) => t.risk)
    .sort((a, b) => b - a)
    .slice(0, 3)

  const base = top3.reduce((sum, r) => sum + r, 0) / top3.length

  // Boost for tracker quantity (max +15)
  const countBoost = Math.min(15, Math.floor(trackers.length / 3) * 3)

  return Math.min(100, Math.round(base + countBoost))
}

export function riskLabel(score: number): string {
  if (score <= 30) return "Bajo"
  if (score <= 60) return "Medio"
  if (score <= 80) return "Alto"
  return "Crítico"
}

export function riskColor(score: number): string {
  if (score <= 30) return "#10B981"
  if (score <= 60) return "#F59E0B"
  if (score <= 80) return "#F97316"
  return "#EF4444"
}

export function riskBgClass(score: number): string {
  if (score <= 30) return "bg-emerald-500"
  if (score <= 60) return "bg-amber-500"
  if (score <= 80) return "bg-orange-500"
  return "bg-red-500"
}

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    advertising:          "Publicidad",
    analytics:            "Analítica",
    social_media:         "Redes sociales",
    fingerprinting:       "Huella digital",
    cdn:                  "CDN",
    hosting:              "Hosting",
    essential:            "Esencial",
    customer_interaction: "Soporte",
    audio_video_player:   "Multimedia",
    extensions:           "Plugin",
    other:                "Otro",
  }
  return labels[category] ?? category
}

export function categoryDotColor(category: string): string {
  const colors: Record<string, string> = {
    advertising:          "#A855F7",  // purple
    analytics:            "#3B82F6",  // blue
    social_media:         "#EC4899",  // pink
    fingerprinting:       "#EF4444",  // red
    cdn:                  "#6B7280",  // gray
    hosting:              "#6B7280",
    essential:            "#10B981",  // green
    customer_interaction: "#F59E0B",  // amber
    audio_video_player:   "#06B6D4",  // cyan
    extensions:           "#8B5CF6",  // violet
  }
  return colors[category] ?? "#6B7280"
}
