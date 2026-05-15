import { useState } from "react"
import type { DetectedTracker } from "../../types/tracker"
import { RiskBadge } from "./RiskBadge"
import { categoryLabel } from "../../utils/risk-calculator"

interface Props {
  tracker: DetectedTracker
}

const CAT_COLOR: Record<string, string> = {
  advertising:    "#7C3AED",
  analytics:      "#2563EB",
  social:         "#059669",
  fingerprinting: "#DC2626",
  cdn:            "#D97706",
  essential:      "#6B7280",
}

export function TrackerCard({ tracker }: Props) {
  const [expanded, setExpanded] = useState(false)
  const catColor = CAT_COLOR[tracker.category] ?? "#7C3AED"

  return (
    <div
      className="anim-slide-in cursor-pointer select-none"
      style={{ borderBottom: "2px solid #DDD6FE" }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2 transition-colors"
        style={{ background: expanded ? "#EDE9FE" : undefined }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-bold text-xs uppercase tracking-wide"
              style={{ color: "#1A0533" }}
            >
              {expanded ? "▼" : "▶"}
            </span>
            <span
              className="font-bold text-xs uppercase tracking-wide truncate"
              style={{ color: "#1A0533" }}
            >
              {tracker.company}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-4 mt-0.5">
            <span className="text-xs" style={{ color: "#6D28D9" }}>
              {tracker.domain}
            </span>
            <span
              className="text-xs font-bold uppercase px-1"
              style={{
                color: "#F0EBF8",
                background: catColor,
                fontSize: 9,
              }}
            >
              {categoryLabel(tracker.category)}
            </span>
          </div>
        </div>
        <RiskBadge score={tracker.risk} compact />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-3 pt-1 space-y-2"
          style={{ background: "#EDE9FE", borderTop: "1px dashed #C4B5FD" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "#2E1065" }}>
            {tracker.what_they_do_human}
          </p>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#7C3AED" }}>
              ◈ Data collected:
            </p>
            <ul className="space-y-0.5">
              {tracker.data_collected.human.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#3B1F6A" }}>
                  <span style={{ color: "#7C3AED" }}>›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <span
              className="text-xs px-1.5 py-0.5 font-bold uppercase"
              style={{ background: "#fff", border: "1px solid #7C3AED", color: "#7C3AED", fontSize: 9 }}
            >
              {tracker.legal_basis}
            </span>
            {tracker.gdpr_articles.length > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 font-bold"
                style={{ background: "#fff", border: "1px solid #7C3AED", color: "#4C1D95", fontSize: 9 }}
              >
                ART. {tracker.gdpr_articles.join(", ")}
              </span>
            )}
          </div>

          {tracker.dpa?.eu && (
            <p className="text-xs" style={{ color: "#6D28D9", fontSize: 10 }}>
              <span className="font-bold">DPA:</span> {tracker.dpa.eu}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
