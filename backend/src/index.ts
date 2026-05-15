import { Hono } from "hono"
import { cors } from "hono/cors"
import analyze from "./routes/analyze"

type Bindings = {
  GROQ_API_KEY: string
  GEMINI_API_KEY: string
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Chrome extensions send requests from the chrome-extension:// origin
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
)

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }))
app.route("/analyze", analyze)

export default app
