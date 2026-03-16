import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store'
import { Spinner } from '@/components/ui/Spinner'
import { resolveDocumentData } from '@/lib/documentData'

export function DocumentViewer() {
  const { activeModal, activeDocumentId, closeModal, documentFiles } = useStore()
  const open = activeModal === 'viewer'
  const df = activeDocumentId ? documentFiles[activeDocumentId] : null
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pages, setPages] = useState<ImageBitmap[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [missingData, setMissingData] = useState(false)

  useEffect(() => {
    let cancelled = false

    setPages([])
    setCurrentPage(0)
    setMissingData(false)

    if (!open || !df) {
      setLoading(false)
      return
    }

    const loadPdf = async () => {
      setLoading(true)

      try {
        const fileData = await resolveDocumentData(df)
        if (cancelled) return

        if (!fileData) {
          setMissingData(true)
          return
        }

        if (df.format === 'pdf') {
          const pdfjsLib = await import('pdfjs-dist')
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.mjs',
            import.meta.url
          ).href

          const pdfDoc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise
          const bitmaps: ImageBitmap[] = []

          for (let i = 1; i <= Math.min(pdfDoc.numPages, 50); i++) {
            const page = await pdfDoc.getPage(i)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext('2d')!
            await page.render({ canvasContext: ctx, viewport }).promise
            const bitmap = await createImageBitmap(canvas)
            bitmaps.push(bitmap)
          }
          if (!cancelled) setPages(bitmaps)
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(df.format)) {
          const blob = new Blob([fileData], { type: `image/${df.format}` })
          const url = URL.createObjectURL(blob)
          const img = new Image()
          img.src = url
          await new Promise((res) => { img.onload = res })
          const bitmap = await createImageBitmap(img)
          if (!cancelled) setPages([bitmap])
          URL.revokeObjectURL(url)
        }
      } catch (e) {
        console.error('Viewer error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPdf()

    return () => {
      cancelled = true
    }
  }, [open, df?.id])

  useEffect(() => {
    if (!pages[currentPage] || !canvasRef.current) return
    const bitmap = pages[currentPage]
    const canvas = canvasRef.current
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
  }, [pages, currentPage])

  if (!df) return null

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={`👁 ${df.name}`}
      size="xl"
    >
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        {pages.length > 1 && (
          <div className="flex items-center justify-center gap-4 py-2 border-b border-gray-100 bg-gray-50">
            <button
              className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-40"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              ← הקודם
            </button>
            <span className="text-sm text-gray-600">
              עמוד {currentPage + 1} מתוך {pages.length}
            </span>
            <button
              className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-40"
              onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
              disabled={currentPage === pages.length - 1}
            >
              הבא →
            </button>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-700 flex items-start justify-center p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size="lg" />
            </div>
          ) : pages.length === 0 ? (
            <div className="text-gray-400 mt-16 text-sm">
              {missingData
                ? 'נתוני הקובץ לא נטענו. שמור וטען את הפרויקט מחדש.'
                : 'לא ניתן להציג קובץ זה כרגע.'}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="shadow-2xl max-w-full"
              style={{ direction: 'ltr' }}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
