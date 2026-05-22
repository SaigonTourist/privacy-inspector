import React from "react"
import type { CapturedRequest } from "../../types/captured-request"

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function DecodedBlock({ decoded }: { decoded: string }) {
  const nl      = decoded.indexOf("\n")
  const header  = nl > -1 ? decoded.slice(0, nl).trim() : decoded
  const body    = nl > -1 ? decoded.slice(nl + 1).trim() : ""
  const isRTB   = header.startsWith("⚡")
  const accent  = isRTB ? "#F59E0B" : "#06B6D4"
  const bgHead  = isRTB ? "#78350F" : "#164E63"
  const fgHead  = isRTB ? "#FDE68A" : "#A5F3FC"
  const bgBody  = isRTB ? "#FFFBEB" : "#ECFEFF"

  return (
    <div style={{ marginTop: 5, borderLeft: `3px solid ${accent}` }}>
      <div style={{
        background: bgHead, color: fgHead,
        fontSize: 9, padding: "3px 8px",
        fontWeight: "bold", letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        {header}
      </div>
      {body && (
        <pre style={{
          background: bgBody, color: "#1A0533",
          fontSize: 9, lineHeight: 1.6,
          padding: "6px 8px", margin: 0,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          maxHeight: 240, overflowY: "auto", overflowX: "hidden",
          maxWidth: "100%",
          fontFamily: "monospace",
        }}>
          {body}
        </pre>
      )}
    </div>
  )
}

function ParamRow({ label, meaning, key: k, value, decoded, sensitive }: CapturedRequest["params"][0]) {
  return (
    <div className="flex flex-col" style={{ borderBottom: "1px solid #EDE9FE", padding: "5px 0" }}>
      <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: sensitive ? "#EF4444" : "#7C3AED", minWidth: 110 }}
        >
          {k}
        </span>
        <span
          className="text-xs font-mono truncate flex-1 min-w-0"
          style={{ color: "#1A0533", direction: "rtl", textAlign: "left" }}
          title={value}
        >
          {value}
        </span>
      </div>
      {decoded && <DecodedBlock decoded={decoded} />}
      <div className="text-xs mt-1" style={{ color: "#6D28D9" }}>
        {sensitive && <span style={{ color: "#EF4444", marginRight: 4 }}>⚠</span>}
        <span style={{ color: "#4C1D95" }}>{label}:</span>{" "}
        <span style={{ color: "#6D28D9" }}>{meaning}</span>
      </div>
    </div>
  )
}

function CaptureCard({ capture }: { capture: CapturedRequest }) {
  const sensitive = capture.params.filter((p) => p.sensitive)
  const rest      = capture.params.filter((p) => !p.sensitive)
  const hasRTB    = capture.params.some((p) => p.decoded?.startsWith("⚡"))

  const borderColor = hasRTB ? "#F59E0B" : sensitive.length > 0 ? "#EF4444" : "#7C3AED"

  return (
    <div
      className="mx-3 mb-2 anim-slide-in"
      style={{
        border:       "2px solid #DDD6FE",
        borderLeft:   `4px solid ${borderColor}`,
        background:   "#FAF8FF",
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ background: "#1A0533", borderBottom: "1px solid #7C3AED" }}
      >
        <div className="flex items-center gap-2">
          {hasRTB && (
            <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>⚡ RTB</span>
          )}
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#C4B5FD" }}>
            {capture.company}
          </span>
          <span className="text-xs" style={{ color: "#6D28D9" }}>
            {capture.method}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sensitive.length > 0 && (
            <span className="text-xs font-bold" style={{ color: "#EF4444" }}>
              ⚠ {sensitive.length} sensible{sensitive.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs" style={{ color: "#7C3AED" }}>
            {formatTime(capture.timestamp)}
          </span>
        </div>
      </div>

      {/* Domain */}
      <div className="px-2 py-1" style={{ borderBottom: "1px solid #EDE9FE" }}>
        <span className="text-xs" style={{ color: "#9333EA" }}>
          › {capture.domain}
        </span>
      </div>

      {/* Params */}
      <div className="px-2">
        {[...sensitive, ...rest].map((p) => (
          <ParamRow key={p.key} {...p} />
        ))}
      </div>
    </div>
  )
}

export function LiveFeed({ tabId }: { tabId: number }) {
  const [captures, setCaptures] = React.useState<CapturedRequest[]>([])

  React.useEffect(() => {
    if (!tabId) return
    function poll() {
      chrome.runtime
        .sendMessage({ type: "GET_CAPTURES", tabId })
        .then((r) => { if (r?.captures) setCaptures(r.captures) })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  }, [tabId])

  if (captures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
        <div className="anim-blink text-lg font-bold px-4 py-2" style={{ color: "#7C3AED" }}>●</div>
        <p className="text-xs uppercase tracking-wider" style={{ color: "#4C1D95" }}>Escuchando...</p>
        <p className="text-xs" style={{ color: "#9333EA" }}>
          Los datos capturados aparecerán aquí<br />mientras navegás el sitio
        </p>
      </div>
    )
  }

  const rtbCount = captures.filter((c) => c.params.some((p) => p.decoded?.startsWith("⚡"))).length

  return (
    <div>
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "2px solid #DDD6FE", position: "sticky", top: 0, background: "#F5F3FF", zIndex: 1 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest" style={{ color: "#6D28D9" }}>
            ▓ {captures.length} interceptado{captures.length !== 1 ? "s" : ""}
          </span>
          {rtbCount > 0 && (
            <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>
              ⚡ {rtbCount} subasta{rtbCount !== 1 ? "s" : ""} RTB
            </span>
          )}
        </div>
        <span className="anim-blink text-xs font-bold" style={{ color: "#EF4444" }}>● LIVE</span>
      </div>
      {captures.map((c) => (
        <CaptureCard key={c.id} capture={c} />
      ))}
    </div>
  )
}
