import { useState } from "react"
import type { AnalysisResponse, Violation } from "../../utils/ai-client"
import { generateReport, downloadBlob } from "../../utils/pdf-generator"

interface Props {
  site: string
  analysis: AnalysisResponse
  onClose: () => void
}

const SEV_COLOR: Record<Violation["severity"], string> = {
  low: "#10B981", medium: "#EAB308", high: "#F97316", critical: "#EF4444",
}

const SEV_LABEL: Record<Violation["severity"], string> = {
  low: "LOW", medium: "MED", high: "HIGH", critical: "CRIT",
}

const LAW_LABEL: Record<AnalysisResponse["primary_law"], string> = {
  GDPR: "RGPD (EU)", CCPA: "CCPA (CA)", LGPD: "LGPD (BR)",
}

export function AnalysisPanel({ site, analysis, onClose }: Props) {
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [expanded, setExpanded] = useState<number | null>(null)

  async function handleDownload() {
    setPdfState("loading")
    try {
      const { blob, filename } = await generateReport(site, analysis)
      downloadBlob(blob, filename)
      setPdfState("done")
    } catch (err) {
      console.error("[PDF]", err)
      setPdfState("error")
    }
  }

  const riskColor =
    analysis.risk_level === "critical" ? "#EF4444" :
    analysis.risk_level === "high"     ? "#F97316" :
    analysis.risk_level === "medium"   ? "#EAB308" : "#10B981"

  return (
    <div className="flex flex-col font-mono" style={{ color: "#1A0533" }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "#1A0533", borderBottom: "3px solid #7C3AED" }}
      >
        <div>
          <span
            className="anim-float text-xs font-bold uppercase tracking-widest"
            style={{ color: "#C4B5FD" }}
          >
            ◈ AI LEGAL ANALYSIS
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: "#7C3AED" }}>
              {LAW_LABEL[analysis.primary_law]}
            </span>
            {analysis.cached && (
              <span className="text-xs" style={{ color: "#4C1D95" }}>· CACHED</span>
            )}
          </div>
        </div>
        <button
          className="pixel-btn text-xs font-bold uppercase px-2 py-1"
          style={{ background: "#2E1065", color: "#C4B5FD" }}
          onClick={onClose}
        >
          ← BACK
        </button>
      </div>

      {/* Risk score */}
      <div className="px-4 py-3" style={{ borderBottom: "2px solid #DDD6FE", background: "#F0EBF8" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: "#6D28D9" }}>
            AI Risk Score
          </span>
          <span className="text-xs font-bold uppercase" style={{ color: riskColor }}>
            {SEV_LABEL[analysis.risk_level]} [{analysis.risk_score}/100]
          </span>
        </div>
        <div
          className="h-3 flex gap-0.5 p-0.5"
          style={{ background: "#1A0533", border: "2px solid #1A0533" }}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-full"
              style={{ background: i < Math.round(analysis.risk_score / 5) ? riskColor : "#3B1F6A" }}
            />
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto" style={{ maxHeight: 300, background: "#F0EBF8" }}>

        {/* Overall assessment */}
        <div className="px-4 py-3" style={{ borderBottom: "2px solid #DDD6FE" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#7C3AED" }}>
            ◈ Assessment
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "#2E1065" }}>
            {analysis.overall_assessment}
          </p>
        </div>

        {/* Violations */}
        {analysis.violations.length > 0 && (
          <div style={{ borderBottom: "2px solid #DDD6FE" }}>
            <div className="px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7C3AED" }}>
                ◈ Violations ({analysis.violations.length})
              </span>
            </div>
            {analysis.violations.map((v, i) => (
              <div
                key={i}
                className="cursor-pointer"
                style={{
                  borderTop: "1px dashed #C4B5FD",
                  background: expanded === i ? "#EDE9FE" : undefined,
                }}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="px-4 py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold" style={{ color: "#1A0533" }}>
                        {expanded === i ? "▼" : "▶"}
                      </span>
                      <span className="text-xs font-bold uppercase truncate" style={{ color: "#1A0533" }}>
                        {v.company}
                      </span>
                    </div>
                    <p className="text-xs ml-4" style={{ color: "#7C3AED" }}>{v.article}</p>
                  </div>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 shrink-0"
                    style={{
                      background: SEV_COLOR[v.severity],
                      color: "#fff",
                      border: "2px solid #1A0533",
                    }}
                  >
                    {SEV_LABEL[v.severity]}
                  </span>
                </div>
                {expanded === i && (
                  <div className="px-4 pb-2 ml-4">
                    <p className="text-xs mb-1" style={{ color: "#6D28D9" }}>
                      {v.tracker_domain}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#2E1065" }}>
                      {v.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recommended action */}
        <div className="px-4 py-3" style={{ borderBottom: "2px solid #DDD6FE" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#7C3AED" }}>
            ◈ Action
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "#2E1065" }}>
            {analysis.recommended_action}
          </p>
        </div>

        {/* Claim letter */}
        {analysis.claim_letter && (
          <div className="px-4 py-3" style={{ borderBottom: "2px solid #DDD6FE" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#7C3AED" }}>
              ◈ Claim Draft
            </p>
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap"
              style={{
                color: "#2E1065",
                background: "#EDE9FE",
                border: "1px dashed #7C3AED",
                padding: "8px",
                fontFamily: "monospace",
              }}
            >
              {analysis.claim_letter}
            </pre>
          </div>
        )}

        {/* Disclaimer */}
        <div className="px-4 py-3">
          <p
            className="text-xs italic"
            style={{ color: "#9333EA", borderLeft: "2px solid #C4B5FD", paddingLeft: 8 }}
          >
            {analysis.disclaimer}
          </p>
        </div>
      </div>

      {/* Download PDF */}
      <div className="px-4 py-3" style={{ borderTop: "2px solid #DDD6FE", background: "#F0EBF8" }}>
        <button
          onClick={handleDownload}
          disabled={pdfState === "loading"}
          className="pixel-btn w-full py-2.5 px-4 font-mono font-bold text-xs uppercase tracking-widest"
          style={{
            background:
              pdfState === "done"    ? "#059669" :
              pdfState === "error"   ? "#DC2626" :
              pdfState === "loading" ? "#4C1D95" : "#7C3AED",
            color: "#F0EBF8",
          }}
        >
          {pdfState === "idle"    && "[ DOWNLOAD PDF REPORT ]"}
          {pdfState === "loading" && <span className="flex items-center justify-center gap-2">[ GENERATING<span className="anim-blink">█</span> ]</span>}
          {pdfState === "done"    && "[ ✓ PDF SAVED ]"}
          {pdfState === "error"   && "[ ✗ ERROR — RETRY ]"}
        </button>
      </div>
    </div>
  )
}
