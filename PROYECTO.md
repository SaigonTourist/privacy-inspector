# [PROJECT-NAME] — Especificación técnica para Claude Code

> Nombre definitivo pendiente. Usar `privacy-extension` como placeholder en todos los archivos hasta confirmación.

---

## Qué es este proyecto

Extensión de Chrome que detecta y expone, en lenguaje humano, los datos personales que recogen los sitios web visitados. Identifica las empresas rastreadoras por su nombre legal, describe exactamente qué información están tomando, evalúa el riesgo legal bajo GDPR/CCPA/LGPD, y permite al usuario solicitar un análisis profundo con IA bajo demanda.

**No es un bloqueador de trackers.** Es una herramienta de transparencia y acción legal.

---

## Principios de diseño no negociables

1. **Local primero.** El 90% de la inteligencia vive en un JSON bundleado dentro de la extensión. Sin servidor, sin requests, sin límites para el usuario gratuito.
2. **IA solo bajo demanda explícita.** La IA se invoca únicamente cuando el usuario pulsa "Analizar en profundidad" de forma consciente. Nunca automáticamente en cada página.
3. **Costo cero o mínimo.** Todo el stack usa tiers gratuitos hasta que haya ingresos reales. Sin Stripe, sin infraestructura de pago hasta Fase 3.
4. **Producto serio.** Arquitectura profesional desde el día uno, aunque el alcance inicial sea pequeño. No se hacen atajos que haya que rehacer.
5. **Open source.** Código público en GitHub bajo licencia MIT.

---

## Arquitectura — 4 capas

```
┌─────────────────────────────────────────────────────┐
│  CAPA 1 — Extensión Chrome (cliente)                │
│  Plasmo + TypeScript + React + Zustand + Tailwind   │
│  declarativeNetRequest · content script · popup     │
└──────────────────┬──────────────────────────────────┘
                   │ cruza contra
┌──────────────────▼──────────────────────────────────┐
│  CAPA 2 — Base de conocimiento local                │
│  trackers.json bundleado (~1.2MB comprimido)        │
│  Actualización semanal via Cloudflare R2 (diff)     │
└──────────────────┬──────────────────────────────────┘
                   │ solo si usuario pide análisis
┌──────────────────▼──────────────────────────────────┐
│  CAPA 3 — Backend edge (solo features Pro)          │
│  Cloudflare Workers + Hono.js                       │
│  Upstash Redis (caché por dominio, TTL 24h)         │
│  Cloudflare D1 (historial + créditos usuario)       │
└──────────────────┬──────────────────────────────────┘
                   │ solo si no hay caché
┌──────────────────▼──────────────────────────────────┐
│  CAPA 4 — Modelo de IA (bajo demanda)               │
│  Groq — Llama 3.3 70B (gratis, prioridad)          │
│  Gemini Flash 2.0 (backup, gratis)                  │
│  Anthropic claude-sonnet-4-6 (Pro complejo)         │
└─────────────────────────────────────────────────────┘
```

---

## Stack técnico completo

### Extensión (Capa 1)
| Tecnología | Versión | Rol |
|---|---|---|
| Plasmo | latest | Scaffold MV3: manifest, hot reload, messaging |
| TypeScript | 5.x | Lenguaje base |
| React | 18.x | UI popup y side panel |
| Vite | (incluido en Plasmo) | Bundler |
| Zustand | 4.x | Estado global sincronizado con chrome.storage |
| Tailwind CSS | 3.x | Estilos del popup |
| declarativeNetRequest | MV3 nativo | Interceptar requests de terceros |

### Base de conocimiento (Capa 2)
| Fuente | Licencia | Uso |
|---|---|---|
| WhoTracks.me | MIT | Dominio → nombre empresa + categoría |
| Disconnect lists | MPL 2.0 | Categorías: advertising, analytics, social, fingerprinting |
| ToS;DR API | Abierta | Rating A-E de política de privacidad por sitio |
| WHOIS / RDAP | Público | País de registro → ley aplicable |
| ip-api.com | Gratis | Geolocalización usuario → DPA local |
| Texto GDPR/CCPA/LGPD | Dominio público | Artículos citables en informes |

### Backend (Capa 3)
| Tecnología | Plan gratuito | Rol |
|---|---|---|
| Cloudflare Workers | 100k req/día | Runtime edge global |
| Hono.js | — | Framework HTTP para Workers |
| Upstash Redis | 10k cmd/día | Caché análisis por dominio |
| Cloudflare D1 | 5GB + 25M reads/día | Historial + créditos usuario |
| Cloudflare R2 | 10GB + 1M req/mes | Almacenamiento del trackers.json |
| Zod | — | Validación schemas del LLM output |

### Generación de documentos
| Tecnología | Rol |
|---|---|
| @react-pdf/renderer | PDF legal generado en el navegador (local, sin servidor) |
| crypto.subtle (nativo) | Hash SHA-256 del informe como prueba de integridad |
| i18next | Internacionalización carta de reclamación: ES, EN, DE, FR |
| FileSaver.js | Descarga del PDF desde el popup |

---

## Estructura del trackers.json

```json
{
  "version": "1.0.0",
  "updated": "2025-05-14",
  "trackers": {
    "doubleclick.net": {
      "company": "Google LLC",
      "country": "EE.UU.",
      "category": "advertising",
      "risk": 89,
      "gdpr_articles": ["5(1)(b)", "6(1)", "9"],
      "dpa": {
        "eu": "AEPD / CNIL / BfDI según país del usuario",
        "us": "FTC"
      },
      "data_collected": {
        "raw": ["uid", "geo", "behavioral", "cross_site", "device_fingerprint"],
        "human": [
          "Tu historial completo de navegación entre sitios",
          "Tu ubicación aproximada (ciudad, región)",
          "En qué haces clic y cuánto tiempo miras cada sección",
          "Un identificador único que te sigue en miles de webs",
          "Las características de tu dispositivo para identificarte sin cookies"
        ]
      },
      "what_they_do_human": "Google registra cada web que visitas para construir un perfil publicitario. Saben qué productos miras, qué noticias lees y en qué horarios navegas.",
      "legal_basis": "consentimiento (cuestionable)",
      "legal_basis_human": "Alegan que aceptaste sus condiciones al usar servicios de Google, pero este consentimiento raramente es libre ni específico según el GDPR."
    }
  }
}
```

**Campos obligatorios por entrada:** `company`, `country`, `category`, `risk`, `data_collected.human`, `what_they_do_human`.
**Fuentes para construir el JSON:** script de build que descarga WhoTracks.me + Disconnect, enriquece con WHOIS, y genera las descripciones `human` con el LLM offline.

---

## Flujo de usuario — dos modos

### Modo automático (sin IA, sin servidor, $0)
```
Usuario abre web
  → content script detecta dominios de terceros
  → service worker cruza contra trackers.json local
  → popup muestra: empresa, categoría, riesgo, datos en lenguaje humano
  → tiempo de respuesta: <10ms
  → requests de red: 0
```

### Modo análisis profundo (con IA, bajo demanda explícita)
```
Usuario pulsa "Analizar en profundidad"
  → extensión envía JSON estructurado al backend (~400 tokens)
  → backend consulta Redis: ¿hay caché para este dominio?
    → SÍ: devuelve análisis cacheado (sin invocar IA)
    → NO: invoca LLM con prompt especializado GDPR
        → LLM devuelve JSON estructurado via tool_use
        → se cachea en Redis (TTL 24h)
  → extensión recibe análisis completo
  → PDF generado localmente con @react-pdf/renderer
  → usuario descarga informe con hash SHA-256
```

---

## Sistema de créditos (Fase 3, no implementar antes)

| Plan | Análisis/mes | Precio |
|---|---|---|
| Gratuito | 5 | $0 |
| Pro | Ilimitado | $4.99/mes |
| Créditos sueltos | 10 análisis | $0.99 |

> **No implementar Stripe hasta Fase 3.** En Fase 1 y 2 todos los análisis son gratuitos sin límite para facilitar las pruebas.

---

## Prompt del sistema para el LLM

```
Eres un experto en derecho de protección de datos personales con conocimiento 
profundo del RGPD (UE), CCPA/CPRA (California) y LGPD (Brasil).

Recibirás un JSON con los trackers detectados en un sitio web, incluyendo la 
empresa propietaria, los datos que recoge y el artículo GDPR candidato.

Tu tarea es:
1. Evaluar si la recogida de datos tiene base legal válida o constituye una 
   infracción probable.
2. Identificar el artículo específico más relevante (no inventes artículos).
3. Explicar el hallazgo en lenguaje comprensible para una persona sin formación 
   jurídica, en el idioma del usuario.
4. Asignar un nivel de riesgo refinado (0-100) basado en el conjunto de trackers.
5. Si hay infracción probable, redactar el borrador de carta de reclamación 
   dirigida a la autoridad reguladora correspondiente.

RESTRICCIONES:
- Nunca afirmes que una práctica ES ilegal, solo que PODRÍA constituir una 
  infracción sujeta a evaluación por la autoridad competente.
- No inventes jurisprudencia ni cites resoluciones específicas sin base.
- El output debe ser exclusivamente JSON estructurado según el schema recibido.
- Incluir siempre el disclaimer: este análisis es orientativo y no constituye 
  asesoramiento jurídico.

Selección de ley aplicable:
- Usuario en UE o empresa con sede en UE → RGPD
- Usuario en California o empresa operando en California → CCPA/CPRA  
- Usuario en Brasil o empresa con sede en Brasil → LGPD
- En caso de duda → aplicar RGPD como estándar más estricto
```

---

## Planificación de fases

### Fase 1 — Semanas 1–4: Detección básica
- [ ] Setup Plasmo + TypeScript + Tailwind
- [ ] Content script: captura de requests de terceros
- [ ] Service worker: cruce contra trackers.json local
- [ ] Popup: lista trackers con empresa, categoría, riesgo y descripción humana
- [ ] Script de build del trackers.json desde WhoTracks.me + Disconnect
- [ ] Cloudflare R2: publicar trackers.json con update semanal automático
- **Entregable:** extensión instalable que muestra quién te rastrea y qué datos toma, en lenguaje humano

### Fase 2 — Semanas 5–10: Análisis con IA
- [ ] Cloudflare Worker + Hono: endpoint `/analyze`
- [ ] Upstash Redis: caché por dominio
- [ ] Integración Groq (Llama 3.3 70B) + Gemini Flash como fallback
- [ ] Prompt engineering + validación Zod del output
- [ ] Panel extendido en el popup: análisis legal, artículo, riesgo refinado
- [ ] Cloudflare D1: historial de análisis por usuario
- **Entregable:** análisis legal on-demand con IA, sin límites, sin costo

### Fase 3 — Semanas 11–16: Documentos + monetización
- [ ] PDF legal con @react-pdf/renderer + hash SHA-256
- [ ] Carta de reclamación (Art. 15/17/21) en ES, EN, DE, FR
- [ ] Sistema de créditos + Stripe
- [ ] Landing page (Next.js + Vercel)
- [ ] Submit a Chrome Web Store
- **Entregable:** primer producto monetizable publicado

### Fase 4 — Semanas 17–24: Escala
- [ ] Firefox + Edge (mismo codebase Plasmo)
- [ ] Fine-tuning Llama 3.2 3B (Google Colab + Unsloth, gratis)
- [ ] Dashboard web de historial de reclamaciones
- [ ] API pública para despachos legales (B2B)
- [ ] Alertas proactivas: nuevos trackers vs. visita anterior

---

## Estructura de carpetas del proyecto

```
privacy-extension/
├── PROYECTO.md              ← este archivo
├── README.md
├── package.json
├── plasmo.config.ts
├── manifest.json            ← generado por Plasmo
│
├── src/
│   ├── background/
│   │   └── index.ts         ← service worker principal
│   ├── contents/
│   │   └── detector.ts      ← content script de detección
│   ├── popup/
│   │   ├── index.tsx        ← popup principal
│   │   └── components/
│   │       ├── TrackerList.tsx
│   │       ├── TrackerCard.tsx
│   │       ├── RiskBadge.tsx
│   │       └── AnalyzeButton.tsx
│   ├── data/
│   │   └── trackers.json    ← base de conocimiento local
│   └── utils/
│       ├── tracker-lookup.ts  ← lógica de cruce con JSON
│       ├── risk-calculator.ts ← score agregado por página
│       └── ai-client.ts       ← cliente para el backend
│
├── backend/                 ← Cloudflare Worker
│   ├── src/
│   │   ├── index.ts         ← Hono app principal
│   │   ├── routes/
│   │   │   └── analyze.ts   ← endpoint /analyze
│   │   └── lib/
│   │       ├── cache.ts     ← Upstash Redis
│   │       ├── llm.ts       ← cliente Groq/Gemini
│   │       └── prompt.ts    ← system prompt + builder
│   └── wrangler.toml
│
└── scripts/
    └── build-trackers-json.ts  ← descarga WhoTracks.me y genera trackers.json
```

---

## Restricciones y decisiones explícitas

- **MV3 obligatorio.** No usar webRequest. Solo declarativeNetRequest.
- **Sin telemetría.** Ningún dato del usuario se envía sin consentimiento explícito opt-in.
- **PDF en local.** @react-pdf/renderer en el navegador. El contenido del informe nunca pasa por el servidor.
- **El backend recibe solo dominios.** Nunca el historial completo, nunca datos personales del usuario.
- **Límite de reglas MV3:** 30k estáticas + 5k dinámicas. Priorizar los trackers de mayor prevalencia en WhoTracks.me.
- **Caché agresivo:** Redis TTL 24h por dominio. El 80-90% de los análisis deben resolverse desde caché.
- **Disclaimer legal obligatorio** en todo output de IA: "Este análisis es orientativo y no constituye asesoramiento jurídico."

---

## Recursos y referencias

- WhoTracks.me dataset: https://github.com/ghostery/whotracks.me
- Disconnect listas: https://github.com/disconnectme/disconnect-tracking-protection
- Plasmo docs: https://docs.plasmo.com
- Cloudflare Workers docs: https://developers.cloudflare.com/workers
- Hono.js docs: https://hono.dev
- Groq API: https://console.groq.com/docs
- Gemini API: https://ai.google.dev/gemini-api/docs
- ToS;DR API: https://api.tosdr.org
- ip-api.com: https://ip-api.com/docs

---

*Documento generado a partir de la sesión de diseño completa. Versión 1.0 — Mayo 2025.*
