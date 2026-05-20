// Removes the jsPDF dead-code reference to cdnjs.cloudflare.com/pdfobject
// Google Web Store rejects extensions that reference external script URLs,
// even when that code path is never called.
import { readFileSync, writeFileSync, readdirSync } from "fs"
import { join } from "path"

const BUILD = "build/chrome-mv3-prod"
const TARGET = "https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js"

for (const file of readdirSync(BUILD).filter((f) => f.endsWith(".js"))) {
  const path = join(BUILD, file)
  const src  = readFileSync(path, "utf-8")
  if (!src.includes(TARGET)) continue
  writeFileSync(path, src.replaceAll(TARGET, ""))
  console.log(`[postbuild] Patched CDN URL in ${file}`)
}
