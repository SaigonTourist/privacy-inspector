import jsPDF from "jspdf"
import type { AnalysisResponse } from "./ai-client"

// ─── Color palettes ───────────────────────────────────────────────────────────

const C = {
  indigo:   [79,  70,  229] as [number, number, number],
  indigoPale:[199,210, 254] as [number, number, number],
  white:    [255, 255, 255] as [number, number, number],
  gray50:   [249, 250, 251] as [number, number, number],
  gray200:  [229, 231, 235] as [number, number, number],
  gray400:  [156, 163, 175] as [number, number, number],
  gray700:  [55,  65,  81]  as [number, number, number],
  slate400: [148, 163, 184] as [number, number, number],
  slate600: [71,  85,  105] as [number, number, number],
}

const RISK_COLOR: Record<string, [number, number, number]> = {
  low:      [16,  185, 129],
  medium:   [245, 158, 11],
  high:     [249, 115, 22],
  critical: [239, 68,  68],
}

const LAW_LABEL: Record<string, string> = {
  GDPR: "RGPD (UE)", CCPA: "CCPA (California)", LGPD: "LGPD (Brasil)",
}

const SEV_LABEL: Record<string, string> = {
  low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico",
}

// ─── SHA-256 ──────────────────────────────────────────────────────────────────

export async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function canonicalData(site: string, a: AnalysisResponse): string {
  return JSON.stringify({
    site,
    risk_score:         a.risk_score,
    primary_law:        a.primary_law,
    risk_level:         a.risk_level,
    violations:         a.violations,
    overall_assessment: a.overall_assessment,
    recommended_action: a.recommended_action,
    claim_letter:       a.claim_letter ?? null,
  })
}

// ─── PDF writer ───────────────────────────────────────────────────────────────

const ML = 14          // left margin
const MR = 196         // right edge
const PW = MR - ML     // printable width
const PH = 278         // page bottom before footer

class Writer {
  doc: jsPDF
  y = 0
  pageNum = 1

  constructor() {
    this.doc = new jsPDF({ unit: "mm", format: "a4" })
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  ensure(need: number) {
    if (this.y + need > PH) {
      this.doc.addPage()
      this.pageNum++
      this.y = 14
      this.footer()
    }
  }

  footer() {
    this.doc.setFontSize(7)
    this.doc.setFont("helvetica", "normal")
    this.doc.setTextColor(...C.gray400)
    this.doc.text(`Privacy Inspector · Página ${this.pageNum}`, ML, 289)
    this.doc.setTextColor(...C.gray700)
  }

  // ── Primitives ──────────────────────────────────────────────────────────────

  ln(h = 4) { this.y += h }

  fillRect(x: number, y: number, w: number, h: number, color: [number,number,number]) {
    this.doc.setFillColor(...color)
    this.doc.rect(x, y, w, h, "F")
  }

  strokeRect(x: number, y: number, w: number, h: number, color: [number,number,number]) {
    this.doc.setDrawColor(...color)
    this.doc.setLineWidth(0.2)
    this.doc.rect(x, y, w, h, "S")
  }

  line(color: [number,number,number] = C.gray200) {
    this.doc.setDrawColor(...color)
    this.doc.setLineWidth(0.2)
    this.doc.line(ML, this.y, MR, this.y)
    this.ln(3)
  }

  set(font: "normal"|"bold", size: number, color: [number,number,number]) {
    this.doc.setFont("helvetica", font)
    this.doc.setFontSize(size)
    this.doc.setTextColor(...color)
  }

  row(str: string, x: number, opts?: { align?: "right" }) {
    this.doc.text(str, x, this.y, opts)
  }

  /** Wraps and prints text, advances y. */
  block(str: string, x: number, maxW: number, lh = 4.5) {
    const lines = this.doc.splitTextToSize(str, maxW) as string[]
    for (const l of lines) {
      this.ensure(lh + 1)
      this.doc.text(l, x, this.y)
      this.ln(lh)
    }
  }

  // ── Compound components ──────────────────────────────────────────────────────

  riskBar(score: number, level: string) {
    const color = RISK_COLOR[level] ?? C.gray200
    this.doc.setFillColor(...C.gray200)
    this.doc.roundedRect(ML, this.y, PW, 3, 1, 1, "F")
    this.doc.setFillColor(...color)
    this.doc.roundedRect(ML, this.y, PW * score / 100, 3, 1, 1, "F")
    this.ln(7)
  }

  sectionTitle(title: string) {
    this.ensure(10)
    this.ln(3)
    this.set("bold", 7.5, C.indigo)
    this.row(title.toUpperCase(), ML)
    this.ln(2)
    this.doc.setDrawColor(...C.indigo)
    this.doc.setLineWidth(0.3)
    this.doc.line(ML, this.y, MR, this.y)
    this.ln(4)
    this.doc.setTextColor(...C.gray700)
  }

  output(): Blob { return this.doc.output("blob") }
}

// ─── Report builder ───────────────────────────────────────────────────────────

export async function generateReport(
  site: string,
  analysis: AnalysisResponse
): Promise<{ blob: Blob; hash: string; filename: string }> {
  const hash = await sha256(canonicalData(site, analysis))
  const date = new Date().toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })

  const w = new Writer()
  const riskColor = RISK_COLOR[analysis.risk_level] ?? C.gray700

  // ── Header ──────────────────────────────────────────────────────────────────
  w.fillRect(0, 0, 210, 22, C.indigo)
  w.y = 9
  w.set("bold", 14, C.white)
  w.row("INFORME DE PRIVACIDAD", ML + 2)
  w.ln(5.5)
  w.set("normal", 8, C.indigoPale)
  w.row("Privacy Inspector · Análisis legal automatizado", ML + 2)
  w.ln(10)

  // ── Meta boxes ──────────────────────────────────────────────────────────────
  const colW = PW / 4
  const metaY = w.y

  const metas = [
    { label: "Sitio analizado", value: site },
    { label: "Fecha",           value: date },
    { label: "Ley aplicable",   value: LAW_LABEL[analysis.primary_law] ?? analysis.primary_law },
    { label: "Riesgo",          value: `${analysis.risk_score}/100 · ${SEV_LABEL[analysis.risk_level] ?? analysis.risk_level}` },
  ]

  metas.forEach((m, i) => {
    const x = ML + i * colW
    w.strokeRect(x, metaY, colW - 1, 12, C.gray200)

    w.doc.setFontSize(7)
    w.doc.setFont("helvetica", "normal")
    w.doc.setTextColor(...C.gray400)
    w.doc.text(m.label, x + 2, metaY + 4)

    w.doc.setFontSize(8)
    w.doc.setFont("helvetica", "bold")
    w.doc.setTextColor(...(i === 3 ? riskColor : C.gray700))
    w.doc.text(m.value, x + 2, metaY + 9)
  })

  w.y = metaY + 16
  w.riskBar(analysis.risk_score, analysis.risk_level)

  // ── Evaluación general ──────────────────────────────────────────────────────
  w.sectionTitle("Evaluación general")
  w.set("normal", 9, C.gray700)
  w.block(analysis.overall_assessment, ML, PW)

  // ── Infracciones ────────────────────────────────────────────────────────────
  if (analysis.violations.length > 0) {
    w.sectionTitle(`Infracciones detectadas (${analysis.violations.length})`)
    for (const v of analysis.violations) {
      w.ensure(22)
      const sevColor = RISK_COLOR[v.severity] ?? C.gray700

      // left accent bar
      w.fillRect(ML, w.y, 1.5, 14, C.indigo)
      const x = ML + 4

      w.set("bold", 9, C.gray700)
      w.doc.text(v.company, x, w.y)
      w.set("bold", 8, sevColor)
      w.doc.text(SEV_LABEL[v.severity] ?? v.severity, MR, w.y, { align: "right" })
      w.ln(4.5)

      w.set("normal", 7.5, C.gray400)
      w.row(v.tracker_domain, x)
      w.ln(4)

      w.set("bold", 8, C.indigo)
      w.row(v.article, x)
      w.ln(4.5)

      w.set("normal", 8.5, C.gray700)
      w.block(v.explanation, x, PW - 4)
      w.ln(2)
    }
  }

  // ── Acción recomendada ──────────────────────────────────────────────────────
  w.sectionTitle("Acción recomendada")
  w.set("normal", 9, C.gray700)
  w.block(analysis.recommended_action, ML, PW)

  // ── Carta de reclamación ────────────────────────────────────────────────────
  if (analysis.claim_letter) {
    w.sectionTitle("Borrador de carta de reclamación")
    w.set("normal", 8.5, C.gray700)
    w.block(analysis.claim_letter, ML + 2, PW - 4, 4.3)
  }

  // ── Hash ────────────────────────────────────────────────────────────────────
  w.sectionTitle("Integridad del documento")
  w.set("normal", 7.5, C.slate400)
  w.row("SHA-256 (contenido canónico):", ML)
  w.ln(4.5)
  w.doc.setFont("courier", "normal")
  w.doc.setFontSize(7)
  w.doc.setTextColor(...C.slate600)
  const hashLines = w.doc.splitTextToSize(hash, PW) as string[]
  for (const l of hashLines) {
    w.ensure(5)
    w.doc.text(l, ML, w.y)
    w.ln(4)
  }

  // ── Disclaimer ──────────────────────────────────────────────────────────────
  w.ln(4)
  w.line()
  w.set("normal", 7.5, C.gray400)
  w.block(analysis.disclaimer, ML, PW, 4)

  const blob = w.output()
  const safeSite = site.replace(/[^a-z0-9.-]/gi, "_").slice(0, 40)
  const filename = `privacy-report_${safeSite}_${date.replace(/\//g, "-")}.pdf`

  return { blob, hash, filename }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement("a")
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
