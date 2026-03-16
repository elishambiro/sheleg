import type { FileFormat } from '@/types'

export async function extractPageCount(
  data: ArrayBuffer,
  format: FileFormat
): Promise<number> {
  if (format === 'pdf') {
    return extractPdfPageCount(data)
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'tiff'].includes(format)) {
    return 1
  }
  // For Word/Excel/HTML we return 0 (unknown until compiled)
  return 0
}

async function extractPdfPageCount(data: ArrayBuffer): Promise<number> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise
    return doc.numPages
  } catch {
    return 0
  }
}
