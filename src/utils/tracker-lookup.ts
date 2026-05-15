import type { TrackerEntry, DetectedTracker } from "../types/tracker"
import rawData from "../../assets/trackers.json"

type TrackerDB = Record<string, TrackerEntry>

// Bundled fallback — always available, loaded at module init
const BUNDLED_DB = (rawData as { trackers: TrackerDB }).trackers

// Active DB — starts as bundled, replaced by R2 download if a newer version exists
let activeDB: TrackerDB = BUNDLED_DB

/** Replace the active tracker DB (called after a successful R2 update). */
export function setTrackerDB(db: TrackerDB) {
  activeDB = db
}

function lookupHostname(hostname: string): TrackerEntry | null {
  if (activeDB[hostname]) return activeDB[hostname]

  // Walk up subdomain tree: cdn.doubleclick.net → doubleclick.net
  const parts = hostname.split(".")
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".")
    if (activeDB[parent]) return activeDB[parent]
  }

  return null
}

export function lookupDomains(domains: string[]): DetectedTracker[] {
  const seen = new Set<string>()
  const results: DetectedTracker[] = []

  for (const domain of domains) {
    const entry = lookupHostname(domain)
    if (!entry) continue

    const key = `${entry.company}::${domain}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push({ domain, ...entry })
  }

  return results.sort((a, b) => b.risk - a.risk)
}
