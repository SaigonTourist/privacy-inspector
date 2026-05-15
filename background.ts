import { lookupDomains, setTrackerDB } from "./src/utils/tracker-lookup"
import type { DetectedTracker } from "./src/types/tracker"
import { riskColor } from "./src/utils/risk-calculator"

// Set via PLASMO_PUBLIC_TRACKERS_URL in .env
// Format: https://pub-xxx.r2.dev  (or custom domain connected to R2)
// Leave empty to disable remote updates — bundled DB is always the fallback.
const TRACKERS_BASE: string = process.env.PLASMO_PUBLIC_TRACKERS_URL ?? ""

const CACHE_NAME = "trackerdb-v1"
const tabKey = (tabId: number) => `trackers_${tabId}`

// ─── Startup ──────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => initDB())
chrome.runtime.onStartup.addListener(() => initDB())

async function initDB() {
  await loadCachedDB()  // fast: restore R2 download from Cache API
  checkForUpdates()     // async: compare remote version, download if newer
}

// ─── R2 update logic ──────────────────────────────────────────────────────────

/** Restores the last downloaded DB from Cache API (survives service worker restarts). */
async function loadCachedDB() {
  if (!TRACKERS_BASE) return
  try {
    const cache  = await caches.open(CACHE_NAME)
    const cached = await cache.match(`${TRACKERS_BASE}/trackers.json`)
    if (!cached) return
    const data = await cached.json()
    setTrackerDB(data.trackers)
  } catch {
    // Bundled DB remains active
  }
}

/** Fetches version.json; downloads trackers.json only when a newer version exists. */
async function checkForUpdates() {
  if (!TRACKERS_BASE) return
  try {
    const vRes = await fetch(`${TRACKERS_BASE}/version.json`, { cache: "no-store" })
    if (!vRes.ok) return

    const remote = (await vRes.json()) as { updated: string }
    const stored = await chrome.storage.local.get("trackers_version")
    if (stored.trackers_version === remote.updated) return

    const dRes = await fetch(`${TRACKERS_BASE}/trackers.json`)
    if (!dRes.ok) return

    const cache = await caches.open(CACHE_NAME)
    await cache.put(`${TRACKERS_BASE}/trackers.json`, dRes.clone())

    const data = await dRes.json()
    setTrackerDB(data.trackers)
    await chrome.storage.local.set({ trackers_version: remote.updated })
    console.log(`[Privacy Inspector] DB actualizada → ${remote.updated}`)
  } catch {
    // Network error — bundled or cached DB stays active, no user impact
  }
}

// ─── Message handling ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DOMAINS_DETECTED") {
    handleDomainsDetected(message.domains, sender.tab?.id)
      .then(() => sendResponse({ ok: true }))
      .catch(console.error)
    return true
  }

  if (message.type === "GET_TRACKERS") {
    const key = tabKey(message.tabId)
    chrome.storage.local
      .get(key)
      .then((r) => sendResponse({ trackers: r[key] ?? [] }))
      .catch(() => sendResponse({ trackers: [] }))
    return true
  }
})

// ─── Detection logic ──────────────────────────────────────────────────────────

async function handleDomainsDetected(domains: string[], tabId?: number) {
  if (!tabId || !domains.length) return

  const found = lookupDomains(domains)
  if (!found.length) return

  const key    = tabKey(tabId)
  const stored = await chrome.storage.local.get(key)
  const existing: DetectedTracker[] = stored[key] ?? []

  const existingDomains = new Set(existing.map((t) => t.domain))
  const toAdd = found.filter((t) => !existingDomains.has(t.domain))
  if (!toAdd.length) return

  const merged = [...existing, ...toAdd].sort((a, b) => b.risk - a.risk)
  await chrome.storage.local.set({ [key]: merged })
  updateBadge(tabId, merged)
}

function updateBadge(tabId: number, trackers: DetectedTracker[]) {
  const maxRisk = Math.max(...trackers.map((t) => t.risk), 0)
  chrome.action.setBadgeText({ text: String(trackers.length), tabId })
  chrome.action.setBadgeBackgroundColor({ color: riskColor(maxRisk), tabId })
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(tabKey(tabId))
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.storage.local.remove(tabKey(tabId))
    chrome.action.setBadgeText({ text: "", tabId })
  }
})
