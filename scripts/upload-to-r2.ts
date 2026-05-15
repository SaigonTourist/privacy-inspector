#!/usr/bin/env tsx
/**
 * Uploads assets/trackers.json to Cloudflare R2.
 *
 * Required env vars (set in .env or CI secrets):
 *   CF_ACCOUNT_ID   — Cloudflare account ID
 *   CF_API_TOKEN    — API token with R2:Edit permission on the bucket
 *   R2_BUCKET_NAME  — e.g. "privacy-inspector-trackers"
 *
 * Usage:
 *   npm run upload:trackers
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ─── Env validation ───────────────────────────────────────────────────────────

const { CF_ACCOUNT_ID, CF_API_TOKEN, R2_BUCKET_NAME } = process.env

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !R2_BUCKET_NAME) {
  console.error('\nMissing required environment variables:')
  if (!CF_ACCOUNT_ID)  console.error('  CF_ACCOUNT_ID')
  if (!CF_API_TOKEN)   console.error('  CF_API_TOKEN')
  if (!R2_BUCKET_NAME) console.error('  R2_BUCKET_NAME')
  console.error('\nCopy .env.example → .env and fill in the values.\n')
  process.exit(1)
}

// ─── Cloudflare REST API helper ───────────────────────────────────────────────

async function r2Put(key: string, body: string, contentType: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${key}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': contentType,
    },
    body,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`R2 PUT ${key} → ${res.status} ${res.statusText}\n${detail}`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nUploading to Cloudflare R2\n')

  const trackersRaw = readFileSync(join(ROOT, 'assets', 'trackers.json'), 'utf-8')
  const trackers = JSON.parse(trackersRaw) as {
    version: string
    updated: string
    trackers: Record<string, unknown>
  }

  // Lightweight version file — the extension polls this before deciding to download
  const versionJson = JSON.stringify({
    version: trackers.version,
    updated: trackers.updated,
    count:   Object.keys(trackers.trackers).length,
    size:    trackersRaw.length,
  }, null, 2)

  // Upload version.json last so it's never ahead of the data
  process.stdout.write(`  Uploading trackers.json  (${Math.round(trackersRaw.length / 1024)} KB)... `)
  await r2Put('trackers.json', trackersRaw, 'application/json')
  console.log('OK')

  process.stdout.write('  Uploading version.json... ')
  await r2Put('version.json', versionJson, 'application/json')
  console.log('OK')

  console.log(`\n  Bucket:   ${R2_BUCKET_NAME}`)
  console.log(`  Version:  ${trackers.version}`)
  console.log(`  Updated:  ${trackers.updated}`)
  console.log(`  Domains:  ${Object.keys(trackers.trackers).length}\n`)
}

main().catch((err: Error) => {
  console.error('\nFatal:', err.message)
  process.exit(1)
})
