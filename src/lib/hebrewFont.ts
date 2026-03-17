import type { PDFDocument, PDFFont } from 'pdf-lib'

let cachedRegular: ArrayBuffer | null = null
let cachedBold: ArrayBuffer | null = null

async function fetchFont(path: string): Promise<ArrayBuffer | null> {
  const resp = await fetch(path)
  if (!resp.ok) return null
  return resp.arrayBuffer()
}

async function loadFontBytes(bold: boolean): Promise<ArrayBuffer> {
  // Try David (Windows system font, better Hebrew rendering) first,
  // then fall back to the bundled Noto Serif Hebrew (OFL, always present).
  const primary  = bold ? '/fonts/DavidBold.ttf'      : '/fonts/David.ttf'
  const fallback = '/fonts/NotoSerifHebrew.ttf'

  if (bold) {
    if (!cachedBold) {
      cachedBold =
        (await fetchFont(primary)) ??
        (await fetchFont(fallback)) ??
        (() => { throw new Error('Hebrew font not found') })()
    }
    return cachedBold
  }

  if (!cachedRegular) {
    cachedRegular =
      (await fetchFont(primary)) ??
      (await fetchFont(fallback)) ??
      (() => { throw new Error('Hebrew font not found') })()
  }
  return cachedRegular
}

/** @deprecated Use embedHebrewFont directly */
export async function loadDavidFontBytes(bold = false): Promise<ArrayBuffer> {
  return loadFontBytes(bold)
}

export async function embedHebrewFont(pdfDoc: PDFDocument, bold = false): Promise<PDFFont> {
  // @ts-ignore – fontkit types vary by version
  const fontkit = await import('@pdf-lib/fontkit')
  pdfDoc.registerFontkit(fontkit.default ?? fontkit)
  const bytes = await loadFontBytes(bold)
  return pdfDoc.embedFont(bytes, { subset: true })
}
