import { riskColor } from "../../utils/risk-calculator"

interface Props {
  score: number
  compact?: boolean
}

const TIER = (s: number) =>
  s < 30 ? "LOW" : s < 60 ? "MED" : s < 80 ? "HIGH" : "CRIT"

export function RiskBadge({ score, compact }: Props) {
  const color = riskColor(score)

  if (compact) {
    return (
      <span
        className="inline-flex items-center justify-center font-mono font-bold text-xs"
        style={{
          color: "#F0EBF8",
          background: color,
          border: "2px solid #1A0533",
          boxShadow: "2px 2px 0 #1A0533",
          minWidth: 36,
          padding: "1px 4px",
        }}
      >
        {score}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono font-bold text-xs px-2 py-1"
      style={{
        color: "#F0EBF8",
        background: color,
        border: "2px solid #1A0533",
        boxShadow: "2px 2px 0 #1A0533",
      }}
    >
      {TIER(score)} · {score}
    </span>
  )
}
