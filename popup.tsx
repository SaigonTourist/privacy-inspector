import { useEffect, useState } from "react"
import "./style.css"
// @ts-ignore — Parcel url: import gives the hashed runtime URL of the bundled font
import pressStart2pUrl from "url:./assets/fonts/PressStart2P.woff2"

import type { DetectedTracker } from "./src/types/tracker"
import type { AnalysisResponse } from "./src/utils/ai-client"
import { analyzeTrackers } from "./src/utils/ai-client"
import { TrackerList } from "./src/popup/components/TrackerList"
import { AnalyzeButton } from "./src/popup/components/AnalyzeButton"
import { AnalysisPanel } from "./src/popup/components/AnalysisPanel"
import { calcPageRisk, riskColor } from "./src/utils/risk-calculator"

type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: AnalysisResponse }
  | { status: "error"; message: string }

const RISK_LABEL = ["SAFE", "LOW", "MED", "HIGH", "CRIT"]

function riskTier(score: number) {
  if (score < 20)  return 0
  if (score < 40)  return 1
  if (score < 60)  return 2
  if (score < 80)  return 3
  return 4
}

export default function Popup() {
  const [trackers, setTrackers] = useState<DetectedTracker[]>([])
  const [loading, setLoading]   = useState(true)
  const [hostname, setHostname] = useState("")
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" })

  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `@font-face { font-family: 'Press Start 2P'; src: url('${pressStart2pUrl}') format('woff2'); font-display: block; }`
    document.head.appendChild(style)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab?.id) { setLoading(false); return }
        try { setHostname(new URL(tab.url ?? "").hostname) } catch { /**/ }
        const res = await chrome.runtime.sendMessage({ type: "GET_TRACKERS", tabId: tab.id })
        setTrackers(res?.trackers ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAnalyze() {
    setAnalysis({ status: "loading" })
    try {
      const data = await analyzeTrackers(hostname, trackers)
      setAnalysis({ status: "done", data })
    } catch (err) {
      setAnalysis({ status: "error", message: err instanceof Error ? err.message : "ERROR" })
    }
  }

  const pageRisk = calcPageRisk(trackers)
  const tier     = riskTier(pageRisk)
  const rc       = riskColor(pageRisk)

  return (
    <div
      className="w-96 flex flex-col font-mono"
      style={{ minWidth: 384, background: "#F0EBF8", color: "#1A0533" }}
    >
      {/* ── Header ── */}
      <div
        className="scanlines px-4 pt-4 pb-3"
        style={{ background: "#1A0533", borderBottom: "3px solid #7C3AED" }}
      >
        <h1
          className="anim-float-violet font-press-start text-white select-none"
          style={{ fontSize: 11, lineHeight: 1.4 }}
        >
          PRIVACY INSPECTOR
        </h1>
        {hostname ? (
          <p className="text-xs mt-1" style={{ color: "#C4B5FD" }}>
            <span style={{ color: "#7C3AED" }}>› </span>{hostname}
          </p>
        ) : (
          <p className="text-xs mt-1" style={{ color: "#6D28D9" }}>
            <span style={{ color: "#7C3AED" }}>› </span>—
          </p>
        )}
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-xs uppercase tracking-widest" style={{ color: "#7C3AED" }}>
          <span>SCANNING</span>
          <span className="anim-blink">█</span>
        </div>

      ) : trackers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
          <div
            className="anim-float pixel-box-sm text-lg font-bold px-4 py-2"
            style={{ background: "#fff", color: "#10B981" }}
          >
            ✓ CLEAN
          </div>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#4C1D95" }}>
            No trackers detected
          </p>
          <p className="text-xs" style={{ color: "#9333EA" }}>
            This page appears tracker-free
          </p>
        </div>

      ) : analysis.status === "done" ? (
        <AnalysisPanel
          site={hostname}
          analysis={analysis.data}
          onClose={() => setAnalysis({ status: "idle" })}
        />

      ) : (
        <>
          {/* Risk gauge */}
          <div className="px-4 py-3" style={{ borderBottom: "2px solid #DDD6FE" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-widest" style={{ color: "#6D28D9" }}>
                Risk Level
              </span>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: rc }}>
                {RISK_LABEL[tier]} [{pageRisk}]
              </span>
            </div>
            {/* Pixel HP bar */}
            <div
              className="h-3 flex gap-0.5 p-0.5"
              style={{ background: "#1A0533", border: "2px solid #1A0533" }}
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-full"
                  style={{ background: i < Math.round(pageRisk / 5) ? rc : "#3B1F6A" }}
                />
              ))}
            </div>

            {/* Tracker count badge */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: "#7C3AED" }}>
                ▓▓ {trackers.length} TRACKER{trackers.length !== 1 ? "S" : ""} FOUND ▓▓
              </span>
            </div>
          </div>

          {/* Tracker list */}
          <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
            <TrackerList trackers={trackers} />
          </div>

          {/* CTA */}
          <div className="px-4 py-3" style={{ borderTop: "2px solid #DDD6FE" }}>
            {analysis.status === "error" && (
              <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: "#EF4444" }}>
                ✗ {analysis.message}
              </p>
            )}
            <AnalyzeButton
              loading={analysis.status === "loading"}
              onClick={handleAnalyze}
            />
          </div>
        </>
      )}
    </div>
  )
}
