import type { CapturedRequest } from "../../types/captured-request"

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function ParamRow({ label, meaning, key: k, value, sensitive }: CapturedRequest["params"][0]) {
  return (
    <div className="flex flex-col" style={{ borderBottom: "1px solid #EDE9FE", padding: "5px 0" }}>
      {/* Fila técnica */}
      <div className="flex justify-between items-start gap-2">
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: sensitive ? "#EF4444" : "#7C3AED", minWidth: 100 }}
        >
          {k}
        </span>
        <span
          className="text-xs font-mono truncate"
          style={{ color: "#1A0533", maxWidth: 160, direction: "rtl", textAlign: "left" }}
          title={value}
        >
          {value}
        </span>
      </div>
      {/* Traducción coloquial */}
      <div className="text-xs mt-0.5" style={{ color: "#6D28D9" }}>
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

  return (
    <div
      className="mx-3 mb-2 anim-slide-in"
      style={{
        border: "2px solid #DDD6FE",
        borderLeft: `3px solid ${sensitive.length > 0 ? "#EF4444" : "#7C3AED"}`,
        background: "#FAF8FF",
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-2 py-1.5"
        style={{ background: "#1A0533", borderBottom: "1px solid #7C3AED" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: "#C4B5FD" }}
          >
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
        <div
          className="anim-blink text-lg font-bold px-4 py-2"
          style={{ color: "#7C3AED" }}
        >
          ●
        </div>
        <p className="text-xs uppercase tracking-wider" style={{ color: "#4C1D95" }}>
          Escuchando...
        </p>
        <p className="text-xs" style={{ color: "#9333EA" }}>
          Los datos capturados aparecerán aquí<br />mientras navegás el sitio
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "2px solid #DDD6FE" }}>
        <span className="text-xs uppercase tracking-widest" style={{ color: "#6D28D9" }}>
          ▓ {captures.length} interceptado{captures.length !== 1 ? "s" : ""}
        </span>
        <span className="anim-blink text-xs font-bold" style={{ color: "#EF4444" }}>
          ● LIVE
        </span>
      </div>
      {captures.map((c) => (
        <CaptureCard key={c.id} capture={c} />
      ))}
    </div>
  )
}

import React from "react"
