import { lookupDomains, lookupDomain, setTrackerDB } from "./src/utils/tracker-lookup"
import { parseRequest } from "./src/utils/request-parser"
import type { CapturedRequest } from "./src/types/captured-request"
import type { DetectedTracker } from "./src/types/tracker"
import { riskColor } from "./src/utils/risk-calculator"

// @ts-ignore — Parcel url: import resolves to the hashed runtime path
import iconOpenUrl   from "url:./assets/icon-open.png"
// @ts-ignore
import iconMidUrl    from "url:./assets/icon-mid.png"
// @ts-ignore
import iconClosedUrl from "url:./assets/icon-closed.png"

// Set via PLASMO_PUBLIC_TRACKERS_URL in .env
// Format: https://pub-xxx.r2.dev  (or custom domain connected to R2)
// Leave empty to disable remote updates — bundled DB is always the fallback.
const TRACKERS_BASE: string = process.env.PLASMO_PUBLIC_TRACKERS_URL ?? ""

const CACHE_NAME = "trackerdb-v1"
const tabKey = (tabId: number) => `trackers_${tabId}`

// ─── Icon blink animation ─────────────────────────────────────────────────────

type SizedImageData = Record<number, ImageData>
type IconFrames = { open: SizedImageData; mid: SizedImageData; closed: SizedImageData }

let iconFrames: IconFrames | null = null
let blinkHandle: ReturnType<typeof setTimeout> | null = null

async function loadSizedFrame(url: string): Promise<SizedImageData> {
  const blob = await fetch(url).then((r) => r.blob())
  const bmp  = await createImageBitmap(blob)
  const out: SizedImageData = {}
  for (const size of [16, 32, 48, 128]) {
    const canvas = new OffscreenCanvas(size, size)
    const ctx    = canvas.getContext("2d")!
    ctx.drawImage(bmp, 0, 0, size, size)
    out[size] = ctx.getImageData(0, 0, size, size)
  }
  bmp.close()
  return out
}

async function ensureFrames(): Promise<IconFrames | null> {
  if (iconFrames) return iconFrames
  try {
    const [open, mid, closed] = await Promise.all([
      loadSizedFrame(iconOpenUrl as string),
      loadSizedFrame(iconMidUrl as string),
      loadSizedFrame(iconClosedUrl as string),
    ])
    iconFrames = { open, mid, closed }
  } catch {
    // Frame load failed — animation simply won't run
  }
  return iconFrames
}

async function startBlinkLoop() {
  const f = await ensureFrames()
  if (!f) return

  function step(frame: SizedImageData, nextFn: () => void, delay: number) {
    chrome.action.setIcon({ imageData: frame })
    if (blinkHandle) clearTimeout(blinkHandle)
    blinkHandle = setTimeout(nextFn, delay)
  }

  // open → mid → closed → mid → open → (repeat)
  function doOpen()  { step(f.open,   doMid1,  3200) }
  function doMid1()  { step(f.mid,    doClose,   60) }
  function doClose() { step(f.closed, doMid2,   110) }
  function doMid2()  { step(f.mid,    doOpen,    60) }

  doOpen()
}

// ─── Startup ──────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => initDB())
chrome.runtime.onStartup.addListener(() => initDB())

async function initDB() {
  await loadCachedDB()  // fast: restore R2 download from Cache API
  checkForUpdates()     // async: compare remote version, download if newer
  startBlinkLoop()
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

  if (message.type === "GET_CAPTURES") {
    sendResponse({ captures: tabCaptures.get(message.tabId) ?? [] })
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

// ─── Live request interception ────────────────────────────────────────────────

const MAX_CAPTURES = 40
const tabCaptures = new Map<number, CapturedRequest[]>()

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return
    try {
      const hostname = new URL(details.url).hostname
      const entry    = lookupDomain(hostname)
      if (!entry) return

      const params = parseRequest(details)
      if (params.length === 0) return

      const capture: CapturedRequest = {
        id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        domain:    hostname,
        company:   entry.company,
        method:    details.method,
        params,
      }

      const existing = tabCaptures.get(details.tabId) ?? []
      tabCaptures.set(details.tabId, [capture, ...existing].slice(0, MAX_CAPTURES))
    } catch { /* URL inválida — ignorar */ }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
)

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
