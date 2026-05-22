// Protobuf raw decoder + OpenRTB 2.x schema (Google Authorized Buyers)
// Field numbers sourced from: storage.googleapis.com/adx-rtb-dictionaries/openrtb-proto.txt

function base64urlToBytes(s: string): Uint8Array | null {
  try {
    const clean = s.startsWith("!") ? s.slice(1) : s
    const b64 = clean.replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch { return null }
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0, shift = 0
  while (pos < buf.length) {
    const b = buf[pos++]
    result |= (b & 0x7f) << shift
    if (!(b & 0x80)) return [result, pos]
    shift += 7
    if (shift > 28) {
      while (pos < buf.length && (buf[pos++] & 0x80)) {}
      return [result, pos]
    }
  }
  throw new Error("varint truncado")
}

type RawProto = Record<string, string | number | RawProto | (string | number | RawProto)[]>

function decodeRaw(buf: Uint8Array, depth = 0): RawProto | null {
  if (depth > 5 || buf.length === 0) return null
  const out: Record<string, (string | number | RawProto)[]> = {}
  let pos = 0, count = 0
  try {
    while (pos < buf.length) {
      if (count++ > 128) return null
      const [tag, p1] = readVarint(buf, pos); pos = p1
      const field = tag >>> 3, wire = tag & 7
      if (field === 0 || field > 1000) return null
      const key = `${field}`

      let val: string | number | RawProto
      switch (wire) {
        case 0: { const [v, p2] = readVarint(buf, pos); pos = p2; val = v; break }
        case 1: { pos += 8; val = "<i64>"; break }
        case 2: {
          const [len, p2] = readVarint(buf, pos); pos = p2
          if (len < 0 || pos + len > buf.length) return null
          const chunk = buf.slice(pos, pos + len); pos += len
          const nested = depth < 4 ? decodeRaw(chunk, depth + 1) : null
          val = nested ?? (() => {
            try { return new TextDecoder("utf-8", { fatal: true }).decode(chunk) }
            catch { return `<bytes:${len}>` }
          })()
          break
        }
        case 5: {
          const dv = new DataView(buf.buffer, buf.byteOffset + pos, 4)
          val = parseFloat(dv.getFloat32(0, true).toFixed(6)); pos += 4; break
        }
        default: return null
      }
      ;(out[key] ??= []).push(val)
    }
  } catch { return null }
  if (count === 0) return null
  const result: RawProto = {}
  for (const [k, vs] of Object.entries(out)) result[k] = vs.length === 1 ? vs[0] : vs
  return result
}

// ── OpenRTB 2.x field maps (verified against openrtb-proto.txt) ───────────────

const F_BID_REQUEST: Record<string, string> = {
  "1": "id_subasta", "2": "impresiones", "3": "sitio", "4": "app",
  "5": "dispositivo", "6": "usuario", "7": "tipo_subasta",
  "8": "max_espera_ms", "9": "compradores_permitidos",
  "12": "categorias_bloqueadas", "13": "anunciantes_bloqueados",
  "14": "regulaciones", "15": "modo_prueba", "16": "apps_bloqueadas",
  "19": "fuente",
}
const F_IMP: Record<string, string> = {
  "1": "id_impresion", "2": "banner", "3": "video", "7": "tag_anuncio",
  "8": "precio_minimo_usd", "9": "moneda", "11": "deal_privado",
  "13": "nativo", "15": "audio", "16": "clickbrowser",
}
const F_SITE: Record<string, string> = {
  "1": "id_sitio", "2": "nombre_sitio", "3": "dominio",
  "4": "categorias_iab", "5": "cat_seccion", "6": "cat_pagina",
  "7": "url_pagina",         // ← URL exacta que el usuario está viendo
  "8": "tiene_pp", "9": "url_referrer", "11": "editor",
  "13": "palabras_clave", "15": "es_movil",
}
const F_APP: Record<string, string> = {
  "1": "id_app", "2": "nombre_app", "3": "dominio", "4": "categorias_iab",
  "8": "bundle_id", "9": "tiene_pp", "10": "es_pago",
  "11": "editor", "13": "palabras_clave", "16": "url_tienda",
}
const F_PUBLISHER: Record<string, string> = {
  "1": "id_editor",          // ← el publisher que vende el espacio
  "2": "nombre_editor",
  "3": "categorias",
  "4": "dominio_editor",
}
const F_USER: Record<string, string> = {
  "1": "id_usuario",
  "2": "id_para_comprador",  // ← ID que el comprador asignó al usuario
  "3": "anio_nacimiento",    // ← año de nacimiento del usuario
  "4": "genero",             // ← género del usuario (M/F/O)
  "5": "intereses",          // ← palabras clave de interés del usuario
  "6": "datos_custom",
  "7": "geo_usuario",
  "8": "segmentos_datos",
}
const F_DEVICE: Record<string, string> = {
  "1": "do_not_track",
  "2": "user_agent",
  "3": "ip",
  "4": "geo",
  "5": "id_dispositivo_sha1",
  "6": "id_dispositivo_md5",
  "7": "id_plataforma_sha1",
  "8": "id_plataforma_md5",
  "9": "ipv6",
  "10": "operadora",
  "11": "idioma",
  "12": "fabricante",
  "13": "modelo",
  "14": "os",
  "15": "version_os",
  "16": "tiene_js",
  "17": "tipo_conexion",
  "18": "tipo_dispositivo",
  "20": "ifa",               // ← IDFA / GAID — advertising ID del dispositivo
  "21": "mac_sha1",
  "22": "mac_md5",
  "23": "limite_publicidad",
  "24": "version_hw",
  "25": "ancho_px",
  "26": "alto_px",
}
const F_GEO: Record<string, string> = {
  "1": "latitud",
  "2": "longitud",
  "3": "pais",               // field 3, no 4
  "4": "region",
  "5": "region_fips",
  "6": "area_metro",         // field 6, no 8
  "7": "ciudad",             // field 7, no 9
  "8": "codigo_postal",      // field 8, no 10
  "9": "tipo_localizacion",
  "10": "offset_utc",
  "11": "precision_metros",
}

// ── Schema application ────────────────────────────────────────────────────────

function renameFlat(raw: RawProto, schema: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[schema[k] ?? `campo_${k}`] = v
  return out
}

function applyGeo(raw: RawProto): Record<string, unknown> {
  return renameFlat(raw, F_GEO)
}

function applyPublisher(raw: RawProto): Record<string, unknown> {
  return renameFlat(raw, F_PUBLISHER)
}

function applySiteOrApp(raw: RawProto, schema: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const name = schema[k] ?? `campo_${k}`
    if (k === "11" && v && typeof v === "object" && !Array.isArray(v))
      out[name] = applyPublisher(v as RawProto)
    else
      out[name] = v
  }
  return out
}

function applyDevice(raw: RawProto): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const name = F_DEVICE[k] ?? `campo_${k}`
    if (k === "4" && v && typeof v === "object" && !Array.isArray(v))
      out[name] = applyGeo(v as RawProto)
    else
      out[name] = v
  }
  return out
}

function applyUser(raw: RawProto): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const name = F_USER[k] ?? `campo_${k}`
    if (k === "7" && v && typeof v === "object" && !Array.isArray(v))
      out[name] = applyGeo(v as RawProto)
    else
      out[name] = v
  }
  return out
}

function applyImp(raw: RawProto | RawProto[]): unknown {
  const apply = (r: RawProto) => renameFlat(r, F_IMP)
  return Array.isArray(raw) ? raw.map(apply) : apply(raw)
}

function applyRTB(raw: RawProto): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const name = F_BID_REQUEST[k] ?? `campo_${k}`
    const isObj = v && typeof v === "object" && !Array.isArray(v)
    if (k === "2") out[name] = applyImp(v as RawProto | RawProto[])
    else if ((k === "3" || k === "4") && isObj) out[name] = applySiteOrApp(v as RawProto, k === "3" ? F_SITE : F_APP)
    else if (k === "5" && isObj) out[name] = applyDevice(v as RawProto)
    else if (k === "6" && isObj) out[name] = applyUser(v as RawProto)
    else out[name] = v
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────────────

// Matches base64url strings: optional ! prefix, uses - and _
const B64URL_RE = /^!?[A-Za-z0-9\-_]{12,}={0,2}$/

export function tryDecodeProto(raw: string): string | null {
  if (!B64URL_RE.test(raw)) return null
  const bytes = base64urlToBytes(raw)
  if (!bytes || bytes.length < 4) return null
  const proto = decodeRaw(bytes)
  if (!proto) return null

  // Heuristic: ≥2 BidRequest top-level fields → apply RTB schema
  const rtbHits = ["1","2","3","4","5","6"].filter((f) => f in proto).length
  const labeled = rtbHits >= 2 ? applyRTB(proto) : proto
  const header  = rtbHits >= 2
    ? "⚡ Subasta RTB — Google Authorized Buyers\n"
    : "📦 Protobuf decodificado\n"
  return header + JSON.stringify(labeled, null, 2)
}
