import type { CapturedParam } from "../types/captured-request"

interface ParamMeta { label: string; meaning: string; sensitive: boolean }

// Parámetros conocidos de los trackers más comunes
const PARAM_DICT: Record<string, ParamMeta> = {
  // ── Google Analytics 4 ──────────────────────────────────────────────────────
  en:    { label: "Nombre del evento",        meaning: "La acción que realizaste en la página",               sensitive: false },
  cid:   { label: "ID de cliente",            meaning: "Código único que identifica tu navegador",             sensitive: true  },
  uid:   { label: "ID de usuario",            meaning: "Tu ID de usuario si estás logueado",                   sensitive: true  },
  dl:    { label: "URL de la página",         meaning: "La dirección exacta de la página que estás viendo",    sensitive: false },
  dr:    { label: "URL anterior",             meaning: "De qué página venías antes de llegar acá",             sensitive: false },
  dt:    { label: "Título de la página",      meaning: "El título de la pestaña que tenés abierta",            sensitive: false },
  sr:    { label: "Resolución de pantalla",   meaning: "El tamaño en píxeles de tu monitor",                  sensitive: false },
  vp:    { label: "Tamaño de ventana",        meaning: "El tamaño visible de tu navegador",                    sensitive: false },
  ul:    { label: "Idioma del sistema",       meaning: "El idioma configurado en tu navegador",                sensitive: false },
  sid:   { label: "ID de sesión",             meaning: "Código que identifica tu visita actual",               sensitive: true  },
  sct:   { label: "Contador de visitas",      meaning: "Cuántas veces visitaste este sitio",                   sensitive: true  },
  _p:    { label: "Huella de sesión",         meaning: "Hash único que identifica esta sesión específica",     sensitive: true  },
  _s:    { label: "Contador de eventos",      meaning: "Cuántos eventos se enviaron en esta sesión",           sensitive: false },
  seg:   { label: "Actividad",               meaning: "Si interactuaste con la página (clics, scroll, etc.)", sensitive: false },
  tid:   { label: "ID de propiedad",          meaning: "Identificador de la cuenta Analytics del sitio",       sensitive: false },
  v:     { label: "Versión del protocolo",    meaning: "Versión del sistema de rastreo utilizado",             sensitive: false },
  t:     { label: "Tipo de dato",             meaning: "Categoría del dato enviado (visita, evento, etc.)",    sensitive: false },
  // ── Google Analytics Universal ───────────────────────────────────────────────
  _ga:   { label: "Cookie de seguimiento",    meaning: "Identificador persistente que Google usa para seguirte entre sitios", sensitive: true },
  _gid:  { label: "Cookie de sesión",         meaning: "Identificador de sesión que expira cada 24 horas",    sensitive: true  },
  _gac:  { label: "Cookie de campaña",        meaning: "Información del anuncio de Google que te trajo acá",  sensitive: true  },
  // ── Facebook Pixel ───────────────────────────────────────────────────────────
  ev:    { label: "Tipo de evento",           meaning: "La acción que Facebook registró de tu parte",          sensitive: false },
  fbp:   { label: "ID de rastreo Facebook",   meaning: "Cookie que Facebook usa para seguirte entre sitios",  sensitive: true  },
  fbc:   { label: "ID de clic en anuncio",    meaning: "El anuncio de Facebook en el que hiciste clic",       sensitive: true  },
  rl:    { label: "URL anterior",             meaning: "La página que estabas viendo antes de llegar acá",    sensitive: false },
  ts:    { label: "Marca de tiempo",          meaning: "La hora exacta en que ocurrió el evento",             sensitive: false },
  // ── LinkedIn Insight ─────────────────────────────────────────────────────────
  li_fat_id: { label: "ID LinkedIn",          meaning: "Identificador de seguimiento de LinkedIn Ads",        sensitive: true  },
  // ── Twitter/X ────────────────────────────────────────────────────────────────
  twclid:    { label: "ID de clic Twitter",   meaning: "El tweet o anuncio de Twitter en que hiciste clic",   sensitive: true  },
  // ── Genéricos ────────────────────────────────────────────────────────────────
  ip:    { label: "Dirección IP",             meaning: "Tu dirección de red, revela tu ubicación aproximada", sensitive: true  },
  ua:    { label: "Navegador y sistema",      meaning: "Tu navegador, versión y sistema operativo",            sensitive: false },
  ref:   { label: "Página anterior",          meaning: "La URL de la página que estabas viendo antes",        sensitive: false },
  url:   { label: "URL actual",               meaning: "La dirección de la página que visitás",                sensitive: false },
  lang:  { label: "Idioma",                   meaning: "El idioma de tu navegador",                            sensitive: false },
  tz:    { label: "Zona horaria",             meaning: "Tu zona horaria local, revela tu región",              sensitive: false },
  dnt:   { label: "Do Not Track",             meaning: "Si tenés activada la opción 'no rastrear'",           sensitive: false },
  cd:    { label: "Profundidad de color",     meaning: "La cantidad de colores que muestra tu pantalla",      sensitive: false },
}

const IGNORE_KEYS = new Set([
  "gtm", "z", "r", "b", "jscb", "callback", "_", "cb", "random",
  "1", "true", "false", "null", "undefined",
])

const IGNORE_PREFIXES = ["gtm.", "_gtm", "AMP_", "__"]

function isIgnorable(key: string, value: string): boolean {
  if (!value || value.length === 0) return true
  if (IGNORE_KEYS.has(key.toLowerCase())) return true
  if (IGNORE_PREFIXES.some((p) => key.startsWith(p))) return true
  // Valores que son solo números sin significado (flags, versiones)
  if (/^\d$/.test(value)) return true
  return false
}

function makeMeta(key: string): ParamMeta {
  // Busca en el diccionario ignorando prefijos de dominio (ep.X, cd.X)
  const bare = key.split(".").pop() ?? key
  return (
    PARAM_DICT[key] ??
    PARAM_DICT[bare] ??
    { label: key, meaning: "Dato enviado al tracker", sensitive: false }
  )
}

function addParam(params: CapturedParam[], key: string, value: string) {
  if (isIgnorable(key, value)) return
  if (value.length > 500) value = value.slice(0, 497) + "…"
  const meta = makeMeta(key)
  params.push({ key, value, ...meta })
}

function flattenJSON(obj: unknown, prefix: string, out: CapturedParam[]) {
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    if (prefix) addParam(out, prefix, String(obj))
    return
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => flattenJSON(item, `${prefix}[${i}]`, out))
    return
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      flattenJSON(v, prefix ? `${prefix}.${k}` : k, out)
    }
  }
}

export function parseRequest(
  details: chrome.webRequest.WebRequestBodyDetails
): CapturedParam[] {
  const params: CapturedParam[] = []
  const url = new URL(details.url)

  // Parámetros en la URL (GET y POST con query string)
  url.searchParams.forEach((value, key) => addParam(params, key, value))

  // Body del POST
  const body = details.requestBody
  if (body) {
    if (body.formData) {
      for (const [key, values] of Object.entries(body.formData)) {
        for (const value of values) addParam(params, key, value)
      }
    }
    if (body.raw?.length) {
      try {
        const chunks = body.raw.map((r) =>
          r.bytes ? new Uint8Array(r.bytes) : new Uint8Array()
        )
        const merged = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
        let offset = 0
        for (const c of chunks) { merged.set(c, offset); offset += c.length }
        const text = new TextDecoder().decode(merged)

        try {
          flattenJSON(JSON.parse(text), "", params)
        } catch {
          new URLSearchParams(text).forEach((value, key) =>
            addParam(params, key, value)
          )
        }
      } catch { /* body ilegible — ignorar */ }
    }
  }

  // Deduplicar por clave
  const seen = new Set<string>()
  return params.filter((p) => {
    if (seen.has(p.key)) return false
    seen.add(p.key)
    return true
  })
}
