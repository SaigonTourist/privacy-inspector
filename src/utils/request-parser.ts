import type { CapturedParam } from "../types/captured-request"
import { tryDecodeProto } from "./proto-decoder"

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
  // ── Google Publisher Tags (GPT) / Ad Manager ────────────────────────────────
  gpt_m:      { label: "Módulo GPT",              meaning: "Versión del sistema de subastas de anuncios de Google",              sensitive: false },
  gpt_sid:    { label: "Sesión de anuncios",       meaning: "ID de tu sesión en el sistema de publicidad de Google",              sensitive: true  },
  gpt_uid:    { label: "ID de usuario publicitario", meaning: "Identificador que Google usa para perfilarte como audiencia",      sensitive: true  },
  correlator: { label: "Correlador de subasta",    meaning: "Código que sincroniza todos los anuncios cargados en esta página",   sensitive: false },
  iu:         { label: "Unidad de anuncio",        meaning: "El espacio publicitario específico que se está llenando",            sensitive: false },
  sz:         { label: "Tamaño del anuncio",       meaning: "Las dimensiones en píxeles del banner que se va a mostrar",         sensitive: false },
  tile:       { label: "Posición en página",       meaning: "En qué lugar de la página va ubicado el anuncio",                   sensitive: false },
  adtest:     { label: "Modo de prueba",           meaning: "Si el anuncio es real o de prueba",                                 sensitive: false },
  hl:         { label: "Idioma del anuncio",       meaning: "El idioma en que se sirven los anuncios",                           sensitive: false },
  pvsid:      { label: "ID de vista de página",    meaning: "Identifica esta carga de página dentro del sistema de ads",         sensitive: true  },
  prev_scp:   { label: "Targeting anterior",       meaning: "Parámetros de segmentación de la subasta de anuncios anterior",     sensitive: true  },
  scp:        { label: "Parámetros de targeting",  meaning: "Datos usados para decidir qué anuncio mostrarte (intereses, segmento)", sensitive: true },
  u_tz:       { label: "Zona horaria (ads)",       meaning: "Tu zona horaria, usada para mostrar anuncios localizados",          sensitive: false },
  u_his:      { label: "Historial de navegación",  meaning: "Páginas del sitio que visitaste, usadas para retargeting",         sensitive: true  },
  u_h:        { label: "Alto de pantalla (ads)",   meaning: "El alto de tu pantalla, parte del fingerprint publicitario",        sensitive: false },
  u_w:        { label: "Ancho de pantalla (ads)",  meaning: "El ancho de tu pantalla, parte del fingerprint publicitario",       sensitive: false },
  u_ah:       { label: "Alto útil de pantalla",    meaning: "Alto de pantalla descontando barras del sistema",                   sensitive: false },
  u_aw:       { label: "Ancho útil de pantalla",   meaning: "Ancho de pantalla descontando barras del sistema",                  sensitive: false },
  u_cd:       { label: "Profundidad de color (ads)", meaning: "Calidad de color de tu pantalla, parte del fingerprint",         sensitive: false },
  u_sd:       { label: "Densidad de píxeles",      meaning: "Si usás pantalla Retina/HiDPI, revela el tipo de dispositivo",     sensitive: false },
  dt:         { label: "Tiempo de carga",          meaning: "Cuánto tardó en cargar la página (comportamiento del usuario)",     sensitive: false },
  biw:        { label: "Ancho de ventana",         meaning: "El ancho visible de tu navegador",                                  sensitive: false },
  bih:        { label: "Alto de ventana",          meaning: "El alto visible de tu navegador",                                   sensitive: false },
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

// ── Value decoder ─────────────────────────────────────────────────────────────

const BASE64_RE = /^[A-Za-z0-9+/]{8,}={0,2}$/

function tryDecodeValue(raw: string): string | null {
  // 0. Base64url / protobuf (Google RTB, encrypted ad signals, etc.)
  const proto = tryDecodeProto(raw)
  if (proto) return proto

  // 1. Double URL-encoding (%257B → %7B → {…})
  try {
    const once = decodeURIComponent(raw)
    if (once !== raw) {
      try {
        const twice = decodeURIComponent(once)
        if (twice.startsWith("{") || twice.startsWith("[")) {
          return JSON.stringify(JSON.parse(twice), null, 2)
        }
        return twice !== once ? twice : once
      } catch { return once }
    }
  } catch { /* no es URL-encoded */ }

  // 2. Base64 → JSON o texto plano
  if (BASE64_RE.test(raw)) {
    try {
      const decoded = atob(raw)
      try {
        return JSON.stringify(JSON.parse(decoded), null, 2)
      } catch {
        // Solo devolver si el resultado es texto legible (ASCII imprimible)
        if (/^[\x20-\x7E\n\t]*$/.test(decoded) && decoded.length > 2) return decoded
      }
    } catch { /* no es base64 válido */ }
  }

  // 3. JSON stringificado dentro del valor
  if ((raw.startsWith("{") || raw.startsWith("[")) && raw.length > 10) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch { /* no es JSON */ }
  }

  return null
}

function addParam(params: CapturedParam[], key: string, value: string) {
  if (isIgnorable(key, value)) return
  if (value.length > 500) value = value.slice(0, 497) + "…"

  const decoded = tryDecodeValue(value) ?? undefined
  const meta = makeMeta(key)
  params.push({ key, value, decoded, ...meta })
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
