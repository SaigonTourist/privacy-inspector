import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameSite(hostname: string, pageHostname: string): boolean {
  if (hostname === pageHostname) return true
  return (
    hostname.endsWith(`.${pageHostname}`) ||
    pageHostname.endsWith(`.${hostname}`)
  )
}

function extractThirdPartyDomains(): string[] {
  const pageHostname = window.location.hostname
  const domains = new Set<string>()

  for (const entry of performance.getEntriesByType("resource")) {
    try {
      const { hostname } = new URL((entry as PerformanceResourceTiming).name)
      if (hostname && !isSameSite(hostname, pageHostname)) {
        domains.add(hostname)
      }
    } catch {
      // skip malformed URLs
    }
  }

  return [...domains]
}

async function sendDomains(domains: string[]) {
  if (!domains.length) return
  try {
    await chrome.runtime.sendMessage({ type: "DOMAINS_DETECTED", domains })
  } catch {
    // Extension context invalidated (e.g. extension reloaded mid-session)
  }
}

// ─── Initial scan ─────────────────────────────────────────────────────────────

sendDomains(extractThirdPartyDomains())

// ─── Observe future resources ─────────────────────────────────────────────────

const observer = new PerformanceObserver((list) => {
  const pageHostname = window.location.hostname
  const newDomains: string[] = []

  for (const entry of list.getEntries()) {
    try {
      const { hostname } = new URL(entry.name)
      if (hostname && !isSameSite(hostname, pageHostname)) {
        newDomains.push(hostname)
      }
    } catch {
      // skip
    }
  }

  sendDomains(newDomains)
})

observer.observe({ entryTypes: ["resource"] })
