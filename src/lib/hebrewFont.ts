import type { PDFDocument, PDFFont } from 'pdf-lib'

let cachedRegular: ArrayBuffer | null = null
let cachedBold: ArrayBuffer | null = null

async function fetchFont(path: string): Promise<ArrayBuffer> {
  const resp = await fetch(path)
  if (!resp.ok) throw new Error(`Failed to load font: ${path}`)
  return resp.arrayBuffer()
}

export async function loadDavidFontBytes(bold = false): Promise<ArrayBuffer> {
  if (bold) {
    if (!cachedBold) cachedBold = await fetchFont('/fonts/DavidBold.ttf')
    return cachedBold
  }
  if (!cachedRegular) cachedRegular = await fetchFont('/fonts/David.ttf')
  return cachedRegular
}

export async function embedHebrewFont(pdfDoc: PDFDocument, bold = false): Promise<PDFFont> {
  // @ts-ignore – fontkit types vary by version
  const fontkit = await import('@pdf-lib/fontkit')
  pdfDoc.registerFontkit(fontkit.default ?? fontkit)
  const bytes = await loadDavidFontBytes(bold)
  return pdfDoc.embedFont(bytes, { subset: true })
}
