#!/usr/bin/env tsx
/**
 * Build script for src/data/trackers.json
 *
 * Primary source:  @ghostery/trackerdb (MIT) — domains, patterns, organizations, categories
 * Supplement:      Disconnect (MPL 2.0)      — fingerprinting domains not in Ghostery DB
 *
 * Usage:  npm run build:trackers
 * Node:   18+ (native fetch)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'


// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..')
// assets/ is Plasmo's static file directory → accessible via chrome.runtime.getURL('trackers.json')
const OUTPUT = join(ROOT, 'assets', 'trackers.json')

const DISCONNECT_URL =
  'https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json'

// ─── Ghostery trackerdb types ─────────────────────────────────────────────────

interface GhosteryCategory {
  name: string
  color: string
  description: string
}

interface GhosteryOrganization {
  name: string
  description?: string
  website_url?: string
  country?: string
  privacy_url?: string
}

interface GhosteryPattern {
  name: string
  category: string          // Ghostery category key
  organization: string      // organization key
  alias: string | null
  website_url: string | null
  ghostery_id: string | null
  tags: string[]
  domains: string[]
  filters: string[]
}

interface GhosteryTrackerDB {
  categories:    Record<string, GhosteryCategory>
  organizations: Record<string, GhosteryOrganization>
  patterns:      Record<string, GhosteryPattern>
  domains:       Record<string, string>   // domain → pattern key
  filters:       string[]
}

// ─── Disconnect types ─────────────────────────────────────────────────────────

// categories → company name → homepage URL → domains[]
type DisconnectDB = {
  categories: Record<string, Record<string, Record<string, string[]>>>
}

// ─── Output schema ────────────────────────────────────────────────────────────

interface TrackerEntry {
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

interface TrackersJSON {
  version: string
  updated: string
  trackers: Record<string, TrackerEntry>
}

// ─── Internal type ────────────────────────────────────────────────────────────

interface DomainInfo {
  company: string
  country: string
  category: string   // our normalized category
}

// ─── Category profiles ────────────────────────────────────────────────────────

interface CategoryProfile {
  risk: number
  raw: string[]
  human: string[]
  what_they_do: (company: string) => string
  legal_basis: string
  legal_basis_human: string
  gdpr_articles: string[]
}

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  advertising: {
    risk: 78,
    raw: ['uid', 'behavioral', 'cross_site', 'interests'],
    human: [
      'Un identificador único que te sigue en miles de sitios web',
      'Lo que haces clic, lo que lees y cuánto tiempo pasas en cada sección',
      'Tu historial de navegación entre sitios no relacionados entre sí',
      'Tus intereses y preferencias de consumo inferidos',
    ],
    what_they_do: (c) =>
      `${c} registra tu actividad en múltiples sitios para construir un perfil publicitario detallado y mostrarte anuncios personalizados en toda la web.`,
    legal_basis: 'consentimiento (frecuentemente cuestionable)',
    legal_basis_human:
      'Alegan que aceptaste la recopilación de datos al aceptar sus políticas de privacidad. El RGPD exige que el consentimiento sea libre, específico e informado, condiciones que rara vez se cumplen en publicidad programática.',
    gdpr_articles: ['5(1)(b)', '6(1)', '7', '17'],
  },

  analytics: {
    risk: 42,
    raw: ['pageviews', 'referrer', 'device_info', 'session_data'],
    human: [
      'Las páginas que visitas y el tiempo que permaneces en cada una',
      'El sitio web o enlace desde el que llegaste',
      'Información sobre tu dispositivo, sistema operativo y navegador',
      'Cómo navegas: clics, desplazamientos y duración de la visita',
    ],
    what_they_do: (c) =>
      `${c} mide el comportamiento de los visitantes para que el propietario del sitio entienda cómo se usa su contenido. Los datos pueden cruzarse con otros servicios del mismo proveedor.`,
    legal_basis: 'interés legítimo (frecuentemente alegado)',
    legal_basis_human:
      'El propietario del sitio alega interés legítimo en analizar su audiencia. Dependiendo de si los datos se anonimizaron correctamente y del uso de cookies, puede requerir consentimiento explícito bajo el RGPD.',
    gdpr_articles: ['5(1)(c)', '6(1)(f)', '25'],
  },

  social_media: {
    risk: 72,
    raw: ['social_graph', 'identity', 'behavioral', 'cross_site'],
    human: [
      'Tu identidad en redes sociales si tienes sesión iniciada',
      'Las personas y contenidos con los que interactúas',
      'Tu actividad de navegación fuera de la red social',
      'Tu perfil completo cruzado entre el sitio y la plataforma social',
    ],
    what_they_do: (c) =>
      `${c} incrusta código en este sitio que les permite saber que lo visitaste, aunque no uses activamente sus servicios. Si tienes sesión iniciada, pueden vincularlo directamente a tu identidad.`,
    legal_basis: 'consentimiento implícito (cuestionable)',
    legal_basis_human:
      'La plataforma social alega que cargar sus botones o widgets implica consentimiento. El RGPD y varias autoridades europeas han cuestionado esta interpretación en múltiples resoluciones.',
    gdpr_articles: ['5(1)(a)', '6(1)', '9'],
  },

  fingerprinting: {
    risk: 91,
    raw: ['device_fingerprint', 'browser_attributes', 'canvas_fp', 'uid_persistent'],
    human: [
      'Las características únicas de tu dispositivo para identificarte sin cookies',
      'Configuración de tu navegador, fuentes instaladas y plugins activos',
      'Datos del lienzo gráfico (canvas) de tu navegador como huella digital',
      'Un identificador que persiste aunque borres cookies o uses modo incógnito',
    ],
    what_they_do: (c) =>
      `${c} utiliza técnicas de huella digital (fingerprinting) para identificarte sin cookies. Esta técnica es especialmente invasiva porque no puedes evitarla borrando el historial ni usando navegación privada.`,
    legal_basis: 'sin base legal válida (probable infracción)',
    legal_basis_human:
      'El fingerprinting de dispositivos carece de base legal válida bajo el RGPD en prácticamente todos los casos. Múltiples autoridades europeas han sancionado esta práctica como violación grave del derecho a la privacidad.',
    gdpr_articles: ['5(1)(a)', '5(1)(b)', '6(1)', '25'],
  },

  cdn: {
    risk: 12,
    raw: ['ip_address', 'request_metadata'],
    human: [
      'Tu dirección IP al cargar recursos del sitio web',
      'Metadatos técnicos de las solicitudes de red (fecha, hora, tipo de archivo)',
    ],
    what_they_do: (c) =>
      `${c} distribuye el contenido técnico del sitio (imágenes, scripts, fuentes) desde servidores cercanos a tu ubicación. El acceso a tu IP es un efecto técnico del protocolo HTTP, no su propósito principal.`,
    legal_basis: 'interés legítimo (generalmente válido)',
    legal_basis_human:
      'La entrega técnica de contenido mediante CDN es necesaria para el funcionamiento del sitio y se considera un interés legítimo válido. El riesgo es si la empresa CDN cruza datos de IP entre múltiples sitios.',
    gdpr_articles: ['6(1)(f)'],
  },

  hosting: {
    risk: 8,
    raw: ['ip_address', 'request_metadata'],
    human: [
      'Tu dirección IP al acceder al sitio web',
      'Logs técnicos de acceso del servidor web',
    ],
    what_they_do: (c) =>
      `${c} proporciona la infraestructura de servidor donde está alojado el sitio web. El registro de accesos es un requisito técnico estándar de seguridad.`,
    legal_basis: 'interés legítimo',
    legal_basis_human:
      'El alojamiento web tiene base legal sólida para registrar datos técnicos mínimos. El riesgo depende de qué hace el proveedor de hosting con esos registros.',
    gdpr_articles: ['6(1)(f)'],
  },

  essential: {
    risk: 10,
    raw: ['session_token', 'preferences'],
    human: [
      'Token de sesión para mantener tu acceso autenticado',
      'Tus preferencias de consentimiento almacenadas localmente',
    ],
    what_they_do: (c) =>
      `${c} gestiona el consentimiento del usuario o proporciona funcionalidad técnica esencial para el correcto funcionamiento del sitio web.`,
    legal_basis: 'obligación legal / interés legítimo',
    legal_basis_human:
      'Las plataformas de gestión de consentimiento (CMP) tienen base legal para almacenar tus preferencias. Sin embargo, algunas implementaciones recopilan datos analíticos adicionales que requieren base legal separada.',
    gdpr_articles: ['6(1)(c)', '6(1)(f)', '7'],
  },

  customer_interaction: {
    risk: 38,
    raw: ['chat_content', 'device_info', 'session_data', 'identity'],
    human: [
      'El contenido de tu conversación con el chat de soporte',
      'Información sobre tu dispositivo y navegador',
      'Duración e historial de tu sesión en el sitio',
      'Tu nombre y correo electrónico si los proporcionas',
    ],
    what_they_do: (c) =>
      `${c} proporciona herramientas de comunicación como chat en vivo o soporte al cliente. Registra las interacciones para facilitar el servicio, aunque incluye datos personales que introduces en la conversación.`,
    legal_basis: 'interés legítimo / consentimiento',
    legal_basis_human:
      'El uso de herramientas de soporte puede estar justificado por interés legítimo del negocio. Si la herramienta recopila datos de comportamiento para fines adicionales, se requiere base legal separada.',
    gdpr_articles: ['5(1)(b)', '6(1)(a)', '6(1)(f)'],
  },

  audio_video_player: {
    risk: 35,
    raw: ['viewing_history', 'device_info', 'uid'],
    human: [
      'Qué contenido multimedia consumes y durante cuánto tiempo',
      'Información técnica sobre tu dispositivo y conexión',
      'Un identificador para personalizar recomendaciones',
    ],
    what_they_do: (c) =>
      `${c} incorpora un reproductor de medios que registra qué contenidos ves y durante cuánto tiempo. Estos datos pueden usarse para personalizar contenido o con fines publicitarios.`,
    legal_basis: 'interés legítimo (parcialmente)',
    legal_basis_human:
      'La reproducción de contenido multimedia tiene base legal, pero el registro detallado de hábitos de consumo para personalización o publicidad requiere consentimiento explícito.',
    gdpr_articles: ['5(1)(b)', '6(1)(a)', '6(1)(f)'],
  },

  extensions: {
    risk: 20,
    raw: ['pageviews', 'preferences'],
    human: [
      'Las páginas en las que se activa la funcionalidad del componente',
      'Configuración de preferencias del plugin',
    ],
    what_they_do: (c) =>
      `${c} añade funcionalidad adicional al sitio web (formularios, mapas, botones de pago). El alcance de datos depende del tipo específico de plugin.`,
    legal_basis: 'variable según funcionalidad',
    legal_basis_human:
      'La base legal varía completamente según la funcionalidad del plugin. Un plugin de mapas tiene necesidades distintas a uno de pago o de comentarios.',
    gdpr_articles: ['6(1)'],
  },
}

const DEFAULT_PROFILE: CategoryProfile = {
  risk: 20,
  raw: ['ip_address', 'request_metadata'],
  human: [
    'Tu dirección IP al cargar elementos del sitio',
    'Metadatos técnicos de las solicitudes realizadas',
  ],
  what_they_do: (c) =>
    `${c} proporciona servicios técnicos o de contenido al sitio web. El alcance exacto de los datos recopilados depende de la configuración específica del servicio.`,
  legal_basis: 'variable',
  legal_basis_human:
    'La base legal depende del tipo de servicio y de cómo esté configurado. Revisar la política de privacidad del proveedor.',
  gdpr_articles: ['6(1)'],
}

// ─── Country / DPA mapping ────────────────────────────────────────────────────

interface CountryMeta {
  display: string
  dpa_eu: string
  dpa_us: string
}

const COUNTRY_MAP: Record<string, CountryMeta> = {
  US: { display: 'EE.UU.',        dpa_eu: 'AEPD / CNIL / BfDI (según tu país de residencia)', dpa_us: 'FTC' },
  GB: { display: 'Reino Unido',   dpa_eu: 'ICO (UK) / autoridad DPA de tu país',               dpa_us: 'N/A' },
  DE: { display: 'Alemania',      dpa_eu: 'BfDI / autoridad estatal competente',                dpa_us: 'N/A' },
  FR: { display: 'Francia',       dpa_eu: 'CNIL',                                               dpa_us: 'N/A' },
  IE: { display: 'Irlanda',       dpa_eu: 'DPC (Data Protection Commission)',                   dpa_us: 'N/A' },
  NL: { display: 'Países Bajos',  dpa_eu: 'AP (Autoriteit Persoonsgegevens)',                   dpa_us: 'N/A' },
  SE: { display: 'Suecia',        dpa_eu: 'IMY (Integritetsskyddsmyndigheten)',                  dpa_us: 'N/A' },
  ES: { display: 'España',        dpa_eu: 'AEPD (Agencia Española de Protección de Datos)',     dpa_us: 'N/A' },
  CN: { display: 'China',         dpa_eu: 'AEPD / CNIL / BfDI (según tu país de residencia)', dpa_us: 'FTC' },
  RU: { display: 'Rusia',         dpa_eu: 'AEPD / CNIL / BfDI (según tu país de residencia)', dpa_us: 'FTC' },
  CA: { display: 'Canadá',        dpa_eu: 'OPC (Office of the Privacy Commissioner)',           dpa_us: 'FTC' },
  AU: { display: 'Australia',     dpa_eu: 'OAIC (Australian Information Commissioner)',         dpa_us: 'N/A' },
  JP: { display: 'Japón',         dpa_eu: 'PPC (Personal Information Protection Commission)',   dpa_us: 'N/A' },
  KR: { display: 'Corea del Sur', dpa_eu: 'PIPC (Personal Information Protection Commission)', dpa_us: 'N/A' },
  IT: { display: 'Italia',        dpa_eu: 'Garante per la protezione dei dati personali',       dpa_us: 'N/A' },
  PL: { display: 'Polonia',       dpa_eu: 'UODO (Urząd Ochrony Danych Osobowych)',              dpa_us: 'N/A' },
}

const DEFAULT_COUNTRY: CountryMeta = {
  display: 'Internacional',
  dpa_eu:  'Autoridad de Protección de Datos de tu país de residencia',
  dpa_us:  'FTC (si opera en EE.UU.)',
}

const EU_COUNTRIES = new Set([
  'DE','FR','IE','NL','SE','ES','IT','PL','AT','BE','PT','FI','DK',
  'CZ','HU','RO','SK','HR','BG','LT','LV','EE','SI','LU','CY','MT','GR',
])

// ─── Category normalization ───────────────────────────────────────────────────

// Ghostery category keys → our internal category keys
const GHOSTERY_CATEGORY_MAP: Record<string, string> = {
  advertising:          'advertising',
  audio_video_player:   'audio_video_player',
  consent:              'essential',
  customer_interaction: 'customer_interaction',
  extensions:           'extensions',
  hosting:              'hosting',
  misc:                 'cdn',
  pornvertising:        'advertising',
  site_analytics:       'analytics',
  social_media:         'social_media',
  utilities:            'cdn',
}

// Disconnect category keys → our internal category keys
const DISCONNECT_CATEGORY_MAP: Record<string, string> = {
  Advertising:    'advertising',
  Analytics:      'analytics',
  Social:         'social_media',
  Fingerprinting: 'fingerprinting',
  Disconnect:     'advertising',
  Content:        'cdn',
}

// ─── Risk calculation ─────────────────────────────────────────────────────────

function calculateRisk(category: string, countryCode: string, rawData: string[]): number {
  const profile = CATEGORY_PROFILES[category] ?? DEFAULT_PROFILE
  let score = profile.risk

  // Non-EU companies have less GDPR enforcement pressure → higher effective risk for EU users
  if (!EU_COUNTRIES.has(countryCode)) score += 5

  // Cross-site tracking amplifies risk
  if (rawData.includes('cross_site')) score += 6

  // Persistent identifier across sessions
  if (rawData.includes('uid') || rawData.includes('uid_persistent')) score += 4

  return Math.min(100, Math.max(0, score))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, label: string): Promise<T> {
  process.stdout.write(`  Fetching ${label}... `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  const data = await res.json() as T
  const kb = Math.round(Number(res.headers.get('content-length') ?? 0) / 1024)
  console.log(`OK${kb ? ` (${kb} KB)` : ''}`)
  return data
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nBuilding trackers.json\n')

  // 1. Load Ghostery trackerdb from local npm package (fast, reliable)
  process.stdout.write('  Loading @ghostery/trackerdb... ')
  const ghosteryPath = join(ROOT, 'node_modules', '@ghostery', 'trackerdb', 'dist', 'trackerdb.json')
  const ghostery = JSON.parse(readFileSync(ghosteryPath, 'utf-8')) as GhosteryTrackerDB
  console.log(`OK (${Object.keys(ghostery.domains).length} domains, ${Object.keys(ghostery.patterns).length} patterns)`)

  // 2. Fetch Disconnect for fingerprinting supplement
  const disconnect = await fetchJSON<DisconnectDB>(DISCONNECT_URL, 'Disconnect services')

  console.log()

  // 3. Build domain → info map
  const domainMap = new Map<string, DomainInfo>()

  // 3a. Ghostery — primary source
  for (const [domain, patternKey] of Object.entries(ghostery.domains)) {
    const pattern = ghostery.patterns[patternKey]
    if (!pattern) continue

    const orgKey   = pattern.organization
    const org      = ghostery.organizations[orgKey]
    const category = GHOSTERY_CATEGORY_MAP[pattern.category] ?? 'other'

    domainMap.set(domain, {
      company: org?.name ?? pattern.name,
      country: org?.country ?? 'US',
      category,
    })
  }

  // 3b. Disconnect — only to add fingerprinting domains missing from Ghostery
  let fpAdded = 0
  const disconnectFp = disconnect.categories['Fingerprinting'] ?? {}
  for (const [companyName, urlMap] of Object.entries(disconnectFp)) {
    for (const [, domains] of Object.entries(urlMap)) {
      if (!Array.isArray(domains)) continue
      for (const domain of domains) {
        if (!domainMap.has(domain)) {
          domainMap.set(domain, { company: companyName, country: 'US', category: 'fingerprinting' })
          fpAdded++
        } else {
          // Upgrade category to fingerprinting if Disconnect identifies it as such
          const existing = domainMap.get(domain)!
          if (existing.category !== 'fingerprinting') {
            domainMap.set(domain, { ...existing, category: 'fingerprinting' })
          }
        }
      }
    }
  }

  console.log(`  Ghostery:    ${Object.keys(ghostery.domains).length} domains`)
  console.log(`  Disconnect:  ${fpAdded} fingerprinting domains added`)
  console.log(`  Total:       ${domainMap.size} domains\n`)

  // 4. Build final output
  const trackers: Record<string, TrackerEntry> = {}

  for (const [domain, info] of domainMap) {
    const profile     = CATEGORY_PROFILES[info.category] ?? DEFAULT_PROFILE
    const countryMeta = COUNTRY_MAP[info.country] ?? DEFAULT_COUNTRY

    trackers[domain] = {
      company:  info.company,
      country:  countryMeta.display,
      category: info.category,
      risk:     calculateRisk(info.category, info.country, profile.raw),
      gdpr_articles: profile.gdpr_articles,
      dpa: {
        eu: countryMeta.dpa_eu,
        us: countryMeta.dpa_us,
      },
      data_collected: {
        raw:   profile.raw,
        human: profile.human,
      },
      what_they_do_human: profile.what_they_do(info.company),
      legal_basis:        profile.legal_basis,
      legal_basis_human:  profile.legal_basis_human,
    }
  }

  // 5. Write output
  const output: TrackersJSON = {
    version: '1.0.0',
    updated: new Date().toISOString().split('T')[0],
    trackers,
  }

  mkdirSync(join(ROOT, 'assets'), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8')

  const sizeKB = Math.round(JSON.stringify(output).length / 1024)

  // 6. Stats
  const byCategory = Object.values(trackers).reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1
    return acc
  }, {})

  console.log(`Output: ${OUTPUT}`)
  console.log(`Size:   ~${sizeKB} KB uncompressed\n`)
  console.log('By category:')
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(22)} ${String(count).padStart(5)}`)
  }
  console.log()
}

main().catch((err: Error) => {
  console.error('\nFatal:', err.message)
  process.exit(1)
})
