import { PDFDocument, rgb, degrees, PDFName } from 'pdf-lib'
import type { PDFFont, PDFPage, PDFDocument as PDFDocumentType } from 'pdf-lib'
import type { DocumentFile, AnnexEntry, MainDocument } from '@/types'
import type { CompilationSettings } from '@/types/settings.types'
import { loadFileData } from '@/lib/db'
import { embedHebrewFont } from '@/lib/hebrewFont'
import { parseCssColor } from '@/utils/colorUtils'
import { getEffectiveAnnexLabel } from '@/utils/numberingUtils'

export type ProgressCallback = (step: string, percent: number) => void

interface CompileInput {
  documentFiles: Record<string, DocumentFile>
  mainDocuments: MainDocument[]
  annexes: AnnexEntry[]
  settings: CompilationSettings
  projectName?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function compilePdf(
  input: CompileInput,
  onProgress: ProgressCallback = () => {}
): Promise<Uint8Array[]> {
  const { documentFiles, mainDocuments, annexes, settings, projectName } = input

  onProgress('טוען קבצים...', 5)

  // Load binary data
  const fileDataMap: Record<string, ArrayBuffer> = {}
  for (const df of Object.values(documentFiles)) {
    let data = df.fileData
    if (!data && df.fileDataKey) data = await loadFileData(df.fileDataKey)
    if (data) fileDataMap[df.id] = data
  }

  onProgress('ממיר מסמכים...', 15)

  // Convert every file to PDF bytes
  const pdfBytesMap: Record<string, Uint8Array> = {}
  const allDocIds = [
    ...mainDocuments.map((d) => d.documentId),
    ...flattenAnnexes(annexes).map((a) => a.documentId),
  ]

  for (let i = 0; i < allDocIds.length; i++) {
    const docId = allDocIds[i]
    const df = documentFiles[docId]
    const data = fileDataMap[docId]
    if (df && data) {
      pdfBytesMap[docId] = await convertToPdf(df, data)
    }
    onProgress('ממיר מסמכים...', 15 + ((i + 1) / allDocIds.length) * 25)
  }

  onProgress('בונה מסמך...', 42)

  const master = await PDFDocument.create()

  // Embed Hebrew font
  let font: PDFFont
  try {
    font = await embedHebrewFont(master)
  } catch (e) {
    console.warn('Hebrew font failed, using built-in fallback', e)
    const { StandardFonts } = await import('pdf-lib')
    font = await master.embedFont(StandardFonts.Helvetica)
  }

  const strings = getCompileStrings(settings.language)
  const primaryColor = toPdfColor(settings.design.primaryColor, '#4263EB')

  // ── Phase 1: main document pages ──────────────────────────────────────────
  let seqPage = 0
  if (settings.includeCoverPage) {
    drawCoverPage(master.addPage([595, 842]), projectName, settings, font, primaryColor, strings)
    seqPage++
  }

  for (const mainDoc of mainDocuments) {
    const bytes = pdfBytesMap[mainDoc.documentId]
    if (!bytes) continue
    const src = await PDFDocument.load(bytes)
    const pages = await master.copyPages(src, src.getPageIndices())
    for (const p of pages) {
      master.addPage(p)
      seqPage++
    }
  }
  const mainDocsEndSeq = seqPage  // first index AFTER all main-document pages

  const perVolume = settings.volumeStrategy !== 'none'

  // ── Phase 3: TOC placeholder (only for single-volume output) ─────────────
  let tocPageSeq = -1
  if (settings.includeToc && !perVolume) {
    tocPageSeq = seqPage
    master.addPage([595, 842]) // filled in phase 5
    seqPage++
  }

  // ── Phase 4: annexes (separator + content) ────────────────────────────────
  onProgress('מוסיף נספחים...', 55)

  const contentPageOffsets: Record<string, number> = {}
  await mergeAnnexes(
    master, annexes, documentFiles, pdfBytesMap,
    settings, font, { seqPage }, contentPageOffsets, strings, settings.numberingStyle
  )

  // ── Phase 5: fill TOC (single-volume only) ────────────────────────────────
  if (settings.includeToc && !perVolume && tocPageSeq >= 0) {
    onProgress('יוצר תוכן עניינים...', 85)
    fillTocPage(
      master.getPage(tocPageSeq),
      master,
      annexes, contentPageOffsets, font, strings, primaryColor, settings.numberingStyle
    )
  }

  // ── Phase 6: sequential page numbers on every page (1 → last) ───────────
  if (settings.design.showPageNumbers) {
    const allPages = master.getPages()
    for (let i = 0; i < allPages.length; i++) {
      stampSequentialPage(allPages[i], i + 1, font)
    }
  }

  onProgress('שומר קובץ...', 95)
  const finalBytes = await master.save()

  if (perVolume) {
    return splitVolumes(
      finalBytes, master, settings,
      annexes, contentPageOffsets,
      mainDocsEndSeq
    )
  }

  onProgress('הושלם!', 100)
  return [finalBytes]
}

// ─────────────────────────────────────────────────────────────────────────────
// Annex merging — recursive for sub-annexes
// ─────────────────────────────────────────────────────────────────────────────

async function mergeAnnexes(
  master: PDFDocumentType,
  annexes: AnnexEntry[],
  documentFiles: Record<string, DocumentFile>,
  pdfBytesMap: Record<string, Uint8Array>,
  settings: CompilationSettings,
  font: PDFFont,
  counter: { seqPage: number },
  contentPageOffsets: Record<string, number>,
  strings: CompileStrings,
  numberingStyle: CompilationSettings['numberingStyle']
): Promise<void> {
  for (const annex of annexes) {
    const bytes = pdfBytesMap[annex.documentId]
    const df = documentFiles[annex.documentId]
    if (!bytes || !df) continue

    const label = getEffectiveAnnexLabel(annex, numberingStyle)
    const description = annex.description

    // Add separator page first
    const separatorPage = master.addPage([595, 842])
    counter.seqPage++

    const contentStartSeq = counter.seqPage

    // Add content pages
    const src = await PDFDocument.load(bytes)
    let indices = src.getPageIndices()
    if (df.pageRange) {
      indices = indices.slice(df.pageRange.from - 1, df.pageRange.to)
    }

    const copied = await master.copyPages(src, indices)
    contentPageOffsets[annex.id] = contentStartSeq

    for (let pi = 0; pi < copied.length; pi++) {
      const page = copied[pi]
      if (df.rotation !== 0) page.setRotation(degrees(df.rotation))
      master.addPage(page)
      if (pi === 0 && settings.autoMarkFirstPage) {
        stampAnnexOnFirstPage(page, label, font, settings.annexLabelPosition, strings)
      }
      applyAnnotations(page, df, pi)
      counter.seqPage++
    }

    // Fill separator now that we know the content start page
    drawSeparatorPage(
      separatorPage,
      label,
      description,
      contentStartSeq + 1,  // 1-based page number shown on separator
      font,
      strings
    )

    // Recurse into sub-annexes
    if (annex.subAnnexes.length > 0) {
      await mergeAnnexes(
        master, annex.subAnnexes, documentFiles, pdfBytesMap,
        settings, font, counter, contentPageOffsets, strings, numberingStyle
      )
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Separator page — matches sample PDF template exactly
//
//  595×842 (A4)
//  y:737  "נספח [label]"        size 36, centered
//  y:647  "[label] [description]" size 36, centered
//  y:468  "עמ' [N]"             size 36, centered
//  y:24   [seq_num]              size 12, x:292
// ─────────────────────────────────────────────────────────────────────────────

function drawSeparatorPage(
  page: PDFPage,
  label: string,
  description: string,
  firstContentPageNum: number,
  font: PDFFont,
  strings: CompileStrings
): void {
  const W = 595
  const black = rgb(0, 0, 0)

  const annexTitle = `${strings.annexWord} ${label}`
  const labelLine = description || label
  const pageRef = `${strings.pageAbbr} ${firstContentPageNum}`

  const cx = (text: string, size: number) => {
    try {
      return Math.max(20, (W - font.widthOfTextAtSize(text, size)) / 2)
    } catch {
      return 253
    }
  }

  page.drawText(annexTitle, { x: cx(annexTitle, 36), y: 737, size: 36, font, color: black })
  page.drawText(labelLine,  { x: cx(labelLine, 36),  y: 647, size: 36, font, color: black })
  page.drawText(pageRef,    { x: cx(pageRef, 36),    y: 468, size: 36, font, color: black })
  // Page number is added by Phase 6 (stampSequentialPage) — do NOT draw it here
}

function drawCoverPage(
  page: PDFPage,
  projectName: string | undefined,
  settings: CompilationSettings,
  font: PDFFont,
  accentColor: ReturnType<typeof rgb>,
  strings: CompileStrings
): void {
  const width = 595
  const title = settings.design.coverTitle.trim() || projectName?.trim() || strings.defaultCoverTitle
  const subtitle = settings.design.coverSubtitle.trim() || strings.defaultCoverSubtitle
  const lightAccent = toPdfColor(settings.design.primaryColor, '#DCE4FF')

  page.drawRectangle({ x: 0, y: 760, width, height: 82, color: accentColor })
  page.drawRectangle({ x: 0, y: 0, width, height: 38, color: accentColor })
  page.drawRectangle({ x: 70, y: 603, width: width - 140, height: 3, color: lightAccent })

  drawCenteredText(page, title, 490, 30, font, rgb(0.08, 0.12, 0.22))
  drawCenteredText(page, subtitle, 440, 16, font, rgb(0.32, 0.36, 0.45))
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  const width = 595
  let textWidth = 100
  try {
    textWidth = font.widthOfTextAtSize(text, size)
  } catch {
    // Keep fallback width if the font cannot measure the text.
  }

  page.drawText(text, {
    x: Math.max(20, (width - textWidth) / 2),
    y,
    size,
    font,
    color,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotation helpers — convert visual coords to pdf-lib MediaBox coords
// ─────────────────────────────────────────────────────────────────────────────

function getNormalizedRotation(page: PDFPage): number {
  return ((page.getRotation().angle % 360) + 360) % 360
}

function getVisualSize(page: PDFPage): { width: number; height: number } {
  const { width: W, height: H } = page.getSize()
  const rot = getNormalizedRotation(page)
  if (rot === 90 || rot === 270) return { width: H, height: W }
  return { width: W, height: H }
}

/** Convert a position in visual (display) space to MediaBox coordinate space.
 *
 *  Visual coordinates here use a bottom-left origin, matching normal PDF pages.
 *  For rotated pages we invert the viewer rotation back into MediaBox space.
 */
function toMediaBox(vx: number, vy: number, page: PDFPage): { x: number; y: number } {
  const { width: W, height: H } = page.getSize()
  const rot = getNormalizedRotation(page)
  switch (rot) {
    case 90:  return { x: W - vy, y: vx     }
    case 180: return { x: W - vx, y: H - vy }
    case 270: return { x: vy,     y: H - vx }
    default:  return { x: vx,     y: vy     }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Annex stamp on first content page — top-left, rotation-aware
// ─────────────────────────────────────────────────────────────────────────────

function stampAnnexOnFirstPage(
  page: PDFPage,
  label: string,
  font: PDFFont,
  position: CompilationSettings['annexLabelPosition'],
  strings: CompileStrings
): void {
  const { width: vW, height: vH } = getVisualSize(page)
  const rot = getNormalizedRotation(page)
  const text = `${strings.annexWord} ${label}`
  let textW = 84
  try { textW = font.widthOfTextAtSize(text, 26) } catch { /* fallback */ }

  const visualX =
    position === 'top-right' || position === 'bottom-right'
      ? Math.max(21, vW - textW - 21)
      : 21
  const visualY =
    position === 'bottom-left' || position === 'bottom-right'
      ? 36
      : vH - 36

  const { x, y } = toMediaBox(visualX, visualY, page)
  page.drawText(text, {
    x, y,
    size: 26,
    rotate: degrees(rot),
    font,
    color: rgb(0, 0, 0),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sequential page number at bottom centre, rotation-aware
// ─────────────────────────────────────────────────────────────────────────────

function stampSequentialPage(page: PDFPage, num: number, font: PDFFont): void {
  const { width: vW } = getVisualSize(page)
  const rot = getNormalizedRotation(page)
  const text = String(num)
  let textW = 8
  try { textW = font.widthOfTextAtSize(text, 12) } catch { /* fallback */ }
  const { x, y } = toMediaBox((vW - textW) / 2, 24, page)
  page.drawText(text, {
    x,
    y,
    size: 12,
    rotate: degrees(rot),
    font,
    color: rgb(0.2, 0.2, 0.2),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TOC page — RTL table layout
//
//  Table columns (right→left):
//    מס'    x: 445–545  (annex number)
//    שם     x: 110–445  (description + label)
//    עמ'    x:  50–110  (page number)
// ─────────────────────────────────────────────────────────────────────────────

function fillTocPage(
  page: PDFPage,
  master: PDFDocumentType,
  annexes: AnnexEntry[],
  contentPageOffsets: Record<string, number>,  // global page numbers for display text
  font: PDFFont,
  strings: CompileStrings,
  accentColor: ReturnType<typeof rgb>,
  numberingStyle: CompilationSettings['numberingStyle'],
  flatOverride?: AnnexEntry[],                 // per-volume: pre-filtered flat list
  linkPageIndices?: Record<string, number>     // per-volume: local 0-based indices for hyperlinks
): void {
  const black  = rgb(0, 0, 0)
  const border = rgb(0.7, 0.7, 0.7)
  const altBg  = rgb(0.97, 0.97, 0.97)

  // Column boundaries (right-to-left order)
  const L = 50, R = 545          // table outer edges
  const col1R = 545, col1L = 450  // מס'  (annex #)
  const col2R = 450, col2L = 110  // שם   (description)
  const col3R = 110, col3L = 50   // עמ'  (page)

  const ROW_H   = 22
  const HEADER_Y = 760
  const DATA_START_Y = HEADER_Y - ROW_H - 2

  // Title
  const title = strings.tocTitle
  let titleW = 100
  try { titleW = font.widthOfTextAtSize(title, 18) } catch { /**/ }
  page.drawText(title, { x: (L + R - titleW) / 2, y: 800, size: 18, font, color: black })

  // ── Header row background
  page.drawRectangle({ x: L, y: HEADER_Y - 4, width: R - L, height: ROW_H + 4, color: accentColor })

  const hCol = (text: string, rightEdge: number) => {
    let w = 30
    try { w = font.widthOfTextAtSize(text, 11) } catch { /**/ }
    return rightEdge - w - 4
  }

  const white = rgb(1, 1, 1)
  page.drawText(strings.tocAnnexHeader, { x: hCol(strings.tocAnnexHeader, col1R), y: HEADER_Y, size: 11, font, color: white })
  page.drawText(strings.tocNameHeader,  { x: hCol(strings.tocNameHeader,  col2R), y: HEADER_Y, size: 11, font, color: white })
  page.drawText(strings.tocPageHeader,  { x: hCol(strings.tocPageHeader,  col3R), y: HEADER_Y, size: 11, font, color: white })

  // ── Data rows
  const flat = flatOverride ?? flattenAnnexes(annexes)
  let y = DATA_START_Y
  const annotRefs: ReturnType<typeof master.context.register>[] = []

  for (let idx = 0; idx < flat.length; idx++) {
    if (y < L + 10) break
    const annex   = flat[idx]
    const pageNum = (contentPageOffsets[annex.id] ?? 0) + 1
    const label = getEffectiveAnnexLabel(annex, numberingStyle)
    const desc    = annex.description || label
    const tocLabel = label || String(idx + 1)

    // Alternating row background
    if (idx % 2 === 1) {
      page.drawRectangle({ x: L, y: y - 5, width: R - L, height: ROW_H, color: altBg })
    }

    // Cell text — right-aligned within each column
    const cellX = (text: string, rightEdge: number, size = 11): number => {
      let w = 20
      try { w = font.widthOfTextAtSize(text, size) } catch { /**/ }
      return Math.max(rightEdge - (rightEdge - (rightEdge === col1R ? col1L : rightEdge === col2R ? col2L : col3L)) + 4,
        rightEdge - w - 4)
    }

    page.drawText(tocLabel, {
      x: cellX(tocLabel, col1R), y, size: 11, font, color: black,
    })

    // Description: clip to column width
    const maxDescW = col2R - col2L - 8
    let dispDesc = desc
    while (dispDesc.length > 1) {
      try {
        if (font.widthOfTextAtSize(dispDesc, 10) <= maxDescW) break
      } catch { break }
      dispDesc = dispDesc.slice(0, -1)
    }
    let descW = 20
    try { descW = font.widthOfTextAtSize(dispDesc, 10) } catch { /**/ }
    page.drawText(dispDesc, { x: col2R - descW - 4, y, size: 10, font, color: black })

    let pgW = 20
    const pgStr = String(pageNum)
    try { pgW = font.widthOfTextAtSize(pgStr, 11) } catch { /**/ }
    page.drawText(pgStr, { x: col3R - pgW - 4, y, size: 11, font, color: black })

    // Row bottom border
    page.drawLine({
      start: { x: L, y: y - 5 }, end: { x: R, y: y - 5 },
      thickness: 0.3, color: border,
    })

    // Hyperlink to first content page
    const targetIdx = (linkPageIndices ?? contentPageOffsets)[annex.id] ?? 0
    if (targetIdx < master.getPageCount()) {
      const linkAnnot = master.context.obj({
        Type: PDFName.of('Annot'),
        Subtype: PDFName.of('Link'),
        Rect: master.context.obj([L, y - 5, R, y + ROW_H - 5]),
        Border: master.context.obj([0, 0, 0]),
        Dest: master.context.obj([master.getPage(targetIdx).ref, PDFName.of('Fit')]),
      })
      annotRefs.push(master.context.register(linkAnnot))
    }

    y -= ROW_H
  }

  if (annotRefs.length > 0) {
    page.node.set(PDFName.of('Annots'), master.context.obj(annotRefs))
  }

  // ── Table outer border
  const tableBottom = y + ROW_H
  const tableTop    = HEADER_Y + ROW_H + 4
  page.drawRectangle({ x: L, y: tableBottom - 5, width: R - L, height: tableTop - tableBottom + 5, borderColor: border, borderWidth: 0.8, color: rgb(1,1,1), opacity: 0 })

  // ── Vertical column dividers
  for (const cx of [col1L, col2L]) {
    page.drawLine({
      start: { x: cx, y: tableBottom - 5 }, end: { x: cx, y: tableTop },
      thickness: 0.4, color: border,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotations (redaction / highlight)
// ─────────────────────────────────────────────────────────────────────────────

function applyAnnotations(page: PDFPage, df: DocumentFile, pageIndex: number): void {
  for (const ann of df.annotations) {
    if (ann.pageIndex !== pageIndex) continue
    const { width, height } = page.getSize()
    if (ann.type === 'redaction') {
      page.drawRectangle({
        x: ann.x * width, y: ann.y * height,
        width: ann.width * width, height: ann.height * height,
        color: rgb(0, 0, 0),
      })
    } else {
      const highlightColor = toPdfColor(ann.color, '#FFFF00')
      page.drawRectangle({
        x: ann.x * width, y: ann.y * height,
        width: ann.width * width, height: ann.height * height,
        color: highlightColor,
        opacity: 0.4,
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Format converters
// ─────────────────────────────────────────────────────────────────────────────

async function convertToPdf(df: DocumentFile, data: ArrayBuffer): Promise<Uint8Array> {
  if (df.format === 'pdf') return new Uint8Array(data)
  if (['jpg', 'jpeg', 'png'].includes(df.format)) return imageToPdf(data, df.format as 'jpg' | 'jpeg' | 'png')
  if (df.format === 'docx' || df.format === 'doc') return wordToPdf(data)
  if (df.format === 'xlsx' || df.format === 'xls') return excelToPdf(data)
  if (df.format === 'html' || df.format === 'htm') return htmlToPdf(data)
  return new Uint8Array(data)
}

async function imageToPdf(data: ArrayBuffer, format: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bytes = new Uint8Array(data)
  const img = format === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
  const { width: iW, height: iH } = img.size()
  const pW = 595, pH = 842
  const scale = Math.min(pW / iW, pH / iH, 1)
  const page = doc.addPage([pW, pH])
  page.drawImage(img, { x: (pW - iW * scale) / 2, y: (pH - iH * scale) / 2, width: iW * scale, height: iH * scale })
  return doc.save()
}

async function wordToPdf(data: ArrayBuffer): Promise<Uint8Array> {
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ arrayBuffer: data })
  return htmlStringToPdf(result.value)
}

async function excelToPdf(data: ArrayBuffer): Promise<Uint8Array> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' })
  return htmlStringToPdf(XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]]))
}

async function htmlToPdf(data: ArrayBuffer): Promise<Uint8Array> {
  return htmlStringToPdf(new TextDecoder().decode(data))
}

interface HtmlBlock {
  text: string
  fontSize: number
  bold: boolean
  spaceBefore: number
  spaceAfter: number
  indent: number
}

function extractNodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  let t = ''
  for (const c of Array.from(node.childNodes)) t += extractNodeText(c)
  return t
}

function collectHtmlBlocks(node: Node, blocks: HtmlBlock[], listDepth = 0, orderedCounters: number[] = []) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ')
    if (text.trim()) blocks.push({ text, fontSize: 10, bold: false, spaceBefore: 0, spaceAfter: 0, indent: 0 })
    return
  }
  const el = node as Element
  const tag = el.tagName?.toLowerCase() ?? ''

  if (tag === 'h1') {
    blocks.push({ text: extractNodeText(el).trim(), fontSize: 18, bold: true, spaceBefore: 12, spaceAfter: 8, indent: 0 })
  } else if (tag === 'h2') {
    blocks.push({ text: extractNodeText(el).trim(), fontSize: 15, bold: true, spaceBefore: 10, spaceAfter: 6, indent: 0 })
  } else if (tag === 'h3') {
    blocks.push({ text: extractNodeText(el).trim(), fontSize: 13, bold: true, spaceBefore: 8, spaceAfter: 4, indent: 0 })
  } else if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
    blocks.push({ text: extractNodeText(el).trim(), fontSize: 11, bold: true, spaceBefore: 6, spaceAfter: 3, indent: 0 })
  } else if (tag === 'p') {
    const text = extractNodeText(el).trim()
    if (text) blocks.push({ text, fontSize: 10, bold: false, spaceBefore: 0, spaceAfter: 6, indent: listDepth * 14 })
  } else if (tag === 'ul' || tag === 'ol') {
    const newCounters = tag === 'ol' ? [...orderedCounters, 0] : orderedCounters
    for (const c of Array.from(el.childNodes)) collectHtmlBlocks(c, blocks, listDepth + 1, newCounters)
  } else if (tag === 'li') {
    const isOrdered = (el.parentElement?.tagName?.toLowerCase() ?? '') === 'ol'
    let bullet = '• '
    if (isOrdered) {
      orderedCounters[orderedCounters.length - 1] = (orderedCounters[orderedCounters.length - 1] ?? 0) + 1
      bullet = `${orderedCounters[orderedCounters.length - 1]}. `
    }
    const text = extractNodeText(el).trim()
    if (text) blocks.push({ text: bullet + text, fontSize: 10, bold: false, spaceBefore: 0, spaceAfter: 3, indent: listDepth * 14 })
  } else if (tag === 'strong' || tag === 'b') {
    const text = extractNodeText(el).trim()
    if (text) blocks.push({ text, fontSize: 10, bold: true, spaceBefore: 0, spaceAfter: 2, indent: listDepth * 14 })
  } else if (tag === 'tr') {
    const cells = Array.from(el.querySelectorAll('td, th')).map(td => extractNodeText(td).trim())
    const text = cells.join('  |  ')
    const isHeader = el.querySelector('th') !== null
    if (text.trim()) blocks.push({ text, fontSize: 9, bold: isHeader, spaceBefore: 1, spaceAfter: 1, indent: 0 })
  } else if (tag === 'br') {
    blocks.push({ text: '', fontSize: 10, bold: false, spaceBefore: 0, spaceAfter: 6, indent: 0 })
  } else if (tag !== 'td' && tag !== 'th') {
    for (const c of Array.from(el.childNodes)) collectHtmlBlocks(c, blocks, listDepth, orderedCounters)
  }
}

async function htmlStringToPdf(html: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  let fontReg: PDFFont, fontBold: PDFFont
  try {
    fontReg = await embedHebrewFont(doc, false)
    fontBold = await embedHebrewFont(doc, true)
  } catch {
    const { StandardFonts } = await import('pdf-lib')
    fontReg = await doc.embedFont(StandardFonts.Helvetica)
    fontBold = fontReg
  }

  const pW = 595, pH = 842, margin = 50

  const domDoc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: HtmlBlock[] = []
  for (const c of Array.from(domDoc.body.childNodes)) collectHtmlBlocks(c, blocks)

  let page = doc.addPage([pW, pH])
  let y = pH - margin

  for (const block of blocks) {
    const font = block.bold ? fontBold : fontReg
    const fs = block.fontSize
    const lh = fs * 1.45
    const blockW = pW - margin * 2 - block.indent

    y -= block.spaceBefore

    if (!block.text.trim()) { y -= lh; continue }

    // Word-wrap
    const words = block.text.split(/\s+/)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w
      try {
        if (font.widthOfTextAtSize(candidate, fs) <= blockW) { cur = candidate }
        else { if (cur) lines.push(cur); cur = w }
      } catch { cur = candidate }
    }
    if (cur) lines.push(cur)

    for (const line of lines) {
      if (y < margin + lh) { page = doc.addPage([pW, pH]); y = pH - margin }
      // Right-align for RTL Hebrew
      let xPos = margin + block.indent
      try {
        const tw = font.widthOfTextAtSize(line, fs)
        xPos = pW - margin - tw
      } catch { /* keep left */ }
      page.drawText(line, { x: Math.max(margin, xPos), y, size: fs, font, color: rgb(0, 0, 0) })
      y -= lh
    }

    y -= block.spaceAfter
  }

  return doc.save()
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume splitting
// ─────────────────────────────────────────────────────────────────────────────

async function splitVolumes(
  finalBytes: Uint8Array,
  master: PDFDocumentType,
  settings: CompilationSettings,
  annexes: AnnexEntry[],
  contentPageOffsets: Record<string, number>,
  mainDocsEndSeq: number   // master page index where main docs end and annexes begin
): Promise<Uint8Array[]> {
  const total = master.getPageCount()
  const bySize = settings.volumeStrategy === 'by-size-mb' && settings.volumeMaxSizeMb > 0
  const byPages = settings.volumeStrategy === 'by-page-count' && settings.volumeMaxPages > 0
  if (!bySize && !byPages) return [finalBytes]

  const maxBytes = bySize ? settings.volumeMaxSizeMb * 1024 * 1024 : Infinity
  // Initial pages-per-volume estimate (average) — used as a starting hint for size mode
  const avgBytesPerPage = finalBytes.length / total
  const initPagesPerVol = byPages
    ? settings.volumeMaxPages
    : Math.max(1, Math.floor(maxBytes / avgBytesPerPage))

  const flat = flattenAnnexes(annexes)
  const volumes: Uint8Array[] = []
  let start = 0

  while (start < total) {
    // ── Find actual end page for this volume ────────────────────────────────
    let end: number

    if (byPages) {
      end = Math.min(start + initPagesPerVol, total)
    } else {
      // MB mode: probe actual size and adjust iteratively (max 4 attempts)
      let trialEnd = Math.min(start + initPagesPerVol, total)
      for (let attempt = 0; attempt < 4 && trialEnd > start; attempt++) {
        const probe = await PDFDocument.create()
        const probePages = await probe.copyPages(
          master,
          Array.from({ length: trialEnd - start }, (_, i) => start + i)
        )
        for (const p of probePages) probe.addPage(p)
        const probeSize = (await probe.save()).length

        if (probeSize <= maxBytes) {
          if (trialEnd === total) break  // everything fits
          // Under limit — try adding more pages proportionally
          const newEnd = Math.min(
            Math.floor(start + (trialEnd - start) * (maxBytes / probeSize)),
            total
          )
          if (newEnd <= trialEnd) break  // no more room
          trialEnd = newEnd
        } else {
          // Over limit — shrink proportionally
          const newEnd = Math.max(
            start + 1,
            Math.floor(start + (trialEnd - start) * (maxBytes / probeSize))
          )
          if (newEnd >= trialEnd) { trialEnd = newEnd; break }
          trialEnd = newEnd
        }
      }
      end = Math.min(trialEnd, total)
    }

    const vol = await PDFDocument.create()

    // Embed Hebrew font fresh for this volume
    let volFont: PDFFont
    try {
      volFont = await embedHebrewFont(vol)
    } catch {
      const { StandardFonts } = await import('pdf-lib')
      volFont = await vol.embedFont(StandardFonts.Helvetica)
    }

    // ── Determine page groups for this volume ─────────────────────────────
    // Main doc pages that fall in [start, end)
    const mainIndices = Array.from(
      { length: Math.max(0, Math.min(end, mainDocsEndSeq) - start) },
      (_, i) => start + i
    )
    // Annex pages that fall in [start, end)  (starts at mainDocsEndSeq)
    const annexStart = Math.max(start, mainDocsEndSeq)
    const annexIndices = Array.from(
      { length: Math.max(0, end - annexStart) },
      (_, i) => annexStart + i
    )

    // ── Build volume: main docs → TOC → annexes ───────────────────────────
    // Step 1: copy main-doc pages (if any in this volume)
    if (mainIndices.length > 0) {
      const mainCopied = await vol.copyPages(master, mainIndices)
      for (const p of mainCopied) vol.addPage(p)
    }

    // Step 2: TOC placeholder (position = right after main docs)
    const tocVolIndex = vol.getPageCount()   // index of the TOC page in this vol
    if (settings.includeToc) {
      vol.addPage([595, 842])
    }

    // Step 3: copy annex pages
    if (annexIndices.length > 0) {
      const annexCopied = await vol.copyPages(master, annexIndices)
      for (const p of annexCopied) vol.addPage(p)
    }

    // Step 4: fill TOC
    if (settings.includeToc) {
      // Annexes whose first content page falls within this volume's page range
      const volFlat = flat.filter(a => {
        const idx = contentPageOffsets[a.id] ?? -1
        return idx >= start && idx < end
      })

      // Local 0-based page indices within this volume for hyperlinks
      // content page `masterIdx` → vol index = mainIndices.length + 1 (TOC) + (masterIdx - annexStart)
      const tocOffset = mainIndices.length + 1
      const localLinkIndices: Record<string, number> = {}
      for (const a of volFlat) {
        localLinkIndices[a.id] = tocOffset + (contentPageOffsets[a.id] - annexStart)
      }

      fillTocPage(
        vol.getPage(tocVolIndex),
        vol,
        annexes,
        contentPageOffsets,    // global numbers for display text
        volFont,
        getCompileStrings(settings.language),
        toPdfColor(settings.design.primaryColor, '#4263EB'),
        settings.numberingStyle,
        volFlat,               // only this volume's annexes
        localLinkIndices       // local indices for clickable links
      )
    }

    volumes.push(await vol.save())
    start = end
  }

  return volumes
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function flattenAnnexes(annexes: AnnexEntry[]): AnnexEntry[] {
  const result: AnnexEntry[] = []
  for (const a of annexes) {
    result.push(a)
    if (a.subAnnexes.length > 0) result.push(...flattenAnnexes(a.subAnnexes))
  }
  return result
}

interface CompileStrings {
  annexWord: string
  pageAbbr: string
  tocTitle: string
  tocAnnexHeader: string
  tocNameHeader: string
  tocPageHeader: string
  defaultCoverTitle: string
  defaultCoverSubtitle: string
}

function getCompileStrings(language: CompilationSettings['language']): CompileStrings {
  switch (language) {
    case 'en':
      return {
        annexWord: 'Appendix',
        pageAbbr: 'P.',
        tocTitle: 'Table of Contents',
        tocAnnexHeader: '#',
        tocNameHeader: 'Appendix',
        tocPageHeader: 'Page',
        defaultCoverTitle: 'Compiled Document',
        defaultCoverSubtitle: 'Main Documents and Appendices',
      }
    case 'he':
    default:
      return {
        annexWord: 'נספח',
        pageAbbr: "עמ'",
        tocTitle: 'תוכן עניינים',
        tocAnnexHeader: "מס'",
        tocNameHeader: 'שם הנספח',
        tocPageHeader: "עמ'",
        defaultCoverTitle: 'מסמך מאוחד',
        defaultCoverSubtitle: 'מסמכים עיקריים ונספחים',
      }
  }
}

function toPdfColor(value: string | undefined, fallback: string): ReturnType<typeof rgb> {
  const { r, g, b } = parseCssColor(value, fallback)
  return rgb(r / 255, g / 255, b / 255)
}
