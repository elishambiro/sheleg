import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/store'
import { compilePdf } from '@/services/compiler'
import { Spinner } from '@/components/ui/Spinner'

export function PdfPreviewPanel() {
  const { mainDocuments, annexes, documentFiles, settings, projectName } = useStore()
  const [pages, setPages] = useState<ImageBitmap[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generate = useCallback(async (
    docs: typeof mainDocuments,
    anx: typeof annexes,
    files: typeof documentFiles,
    stg: typeof settings,
    name: typeof projectName
  ) => {
    cancelRef.current = true // cancel any in-progress render
    await new Promise(r => setTimeout(r, 0)) // flush
    cancelRef.current = false

    setLoading(true)
    setError(null)
    setProgress('מכין...')

    try {
      const volumes = await compilePdf(
        { documentFiles: files, mainDocuments: docs, annexes: anx, settings: stg, projectName: name },
        (step) => { if (!cancelRef.current) setProgress(step) }
      )
      if (cancelRef.current) return

      const pdfData = volumes[0]
      setProgress('מעבד תצוגה מקדימה...')

      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).href

      const pdfDoc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise
      const bitmaps: ImageBitmap[] = []

      for (let i = 1; i <= Math.min(pdfDoc.numPages, 100); i++) {
        if (cancelRef.current) return
        const page = await pdfDoc.getPage(i)
        const viewport = page.getViewport({ scale: 1.2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
        bitmaps.push(await createImageBitmap(canvas))
      }

      if (!cancelRef.current) setPages(bitmaps)
    } catch (e: any) {
      if (!cancelRef.current) setError(e.message)
    } finally {
      if (!cancelRef.current) {
        setLoading(false)
        setProgress('')
      }
    }
  }, [])

  // Auto-generate with debounce when docs/annexes change
  useEffect(() => {
    if (mainDocuments.length === 0 && annexes.length === 0) {
      setPages([])
      setError(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      generate(mainDocuments, annexes, documentFiles, settings, projectName)
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [mainDocuments, annexes, documentFiles, settings])

  const isEmpty = mainDocuments.length === 0 && annexes.length === 0

  return (
    <div className="h-full flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700">👁 תצוגה מקדימה</span>
        {loading && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            {progress}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-700 flex flex-col items-center p-3 gap-3" style={{ direction: 'ltr' }}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <span className="text-4xl">📄</span>
            <p className="text-sm text-center">הוסף מסמכים<br />לתצוגה מקדימה אוטומטית</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <Spinner size="lg" />
            <p className="text-xs">{progress}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-center">{error}</p>
          </div>
        ) : (
          pages.map((bitmap, i) => (
            <PageCanvas key={i} bitmap={bitmap} pageNum={i + 1} total={pages.length} />
          ))
        )}
      </div>
    </div>
  )
}

function PageCanvas({ bitmap, pageNum, total }: { bitmap: ImageBitmap; pageNum: number; total: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Draw once on mount (bitmap is stable)
  const refCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  }, [bitmap])

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <canvas ref={refCallback} className="shadow-xl max-w-full" style={{ direction: 'ltr' }} />
      {total > 1 && (
        <span className="text-xs text-gray-400">{pageNum} / {total}</span>
      )}
    </div>
  )
}
