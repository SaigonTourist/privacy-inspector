# Privacy Inspector

Chrome extension that detects and exposes, in plain language, the personal data collected by websites you visit. Identifies trackers by company name, evaluates GDPR/CCPA/LGPD risk, and provides on-demand AI legal analysis.

## Quick start (no AI)

```bash
git clone https://github.com/SaigonTourist/privacy-inspector.git
cd privacy-inspector
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `build/chrome-mv3-prod/` folder

That's it. Tracker detection works immediately with no API keys needed.

## Enable AI analysis (optional)

The "Deep Analysis" button requires a backend. You can either use the shared instance or deploy your own.

### Use the shared instance

Add to a `.env` file in the project root:

```
PLASMO_PUBLIC_ANALYZE_URL=https://privacy-inspector-api.alan-porco-johnson.workers.dev
```

Then rebuild: `npm run build` and reload the extension.

### Deploy your own backend

```bash
cd backend
npm install
wrangler secret put GROQ_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler deploy
```

Set the printed Worker URL as `PLASMO_PUBLIC_ANALYZE_URL` in your `.env`.

## Tracker database updates (optional)

The bundled database covers 5,000+ domains. To keep it updated weekly via GitHub Actions, add these secrets to your GitHub repo:

- `CF_ACCOUNT_ID`
- `CF_API_TOKEN` (R2:Edit permission)
- `R2_BUCKET_NAME`

And set `PLASMO_PUBLIC_TRACKERS_URL` in your `.env` to your R2 bucket's public URL.

## Tech stack

| Layer | Tech |
|---|---|
| Extension | Plasmo · React · Tailwind CSS |
| Tracker DB | Ghostery TrackerDB · Disconnect lists |
| Backend | Cloudflare Workers · Hono · Zod |
| Cache | Upstash Redis (24h TTL) |
| AI | Groq Llama 3.3 70B → Gemini Flash 2.0 fallback |
| Storage | Cloudflare R2 |

## License

MIT
