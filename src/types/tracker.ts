export interface TrackerEntry {
  company: string
  country: string
  category: string
  risk: number
  gdpr_articles: string[]
  dpa: { eu: string; us: string }
  data_collected: { raw: string[]; human: string[] }
  what_they_do_human: string
  legal_basis: string
  legal_basis_human: string
}

export interface DetectedTracker extends TrackerEntry {
  domain: string
}

// Messages between content script ↔ background ↔ popup
export type ExtMessage =
  | { type: "DOMAINS_DETECTED"; domains: string[] }
  | { type: "GET_TRACKERS"; tabId: number }

export type ExtResponse =
  | { trackers: DetectedTracker[] }
  | { error: string }
