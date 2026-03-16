import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store'
import { Spinner } from '@/components/ui/Spinner'
import { generateId } from '@/utils/fileHelpers'
import type { PageAnnotation } from '@/types'
import { resolveDocumentData } from '@/lib/documentData'
import { toCanvasRgba } from '@/utils/colorUtils'

const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00'

type Tool = 'select' | 'redact' | 'highlight'

interface DrawState {
  active: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function PdfEditorModal() {
  const { activeModal, activeDocumentId, closeModal, documentFiles, updateDocumentFile } = useStore()
  const open = activeModal === 'editor'
  const df = activeDocumentId ? documentFiles[activeDocumentId] : null

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [pages, setPages] = useState<ImageBitmap[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  const [drawing, setDrawing] = useState<DrawState | null>(null)
  const [annotations, setAnnotations] = useState<PageAnnotation[]>([])
  const [missingData, setMissingData] = useState(false)

  useEffect(() => {
    if (df) setAnnotations([...df.annotations])
  }, [df?.id])

  useEffect(() => {
    let cancelled = false

    setPages([])
    setCurrentPage(0)
    setDrawing(null)
    setMissingData(false)

    if (!open || !df || df.format !== 'pdf') {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)

      try {
        const fileData = await resolveDocumentData(df)
        if (cancelled) return

        if (!fileData) {
          setMissingData(true)
          return
        }

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).href
        const pdfDoc = await pdfjsLib.getDocument({ data: fileData.slice(0) }).promise
        const bitmaps: ImageBitmap[] = []
        for (let i = 1; i <= Math.min(pdfDoc.numPages, 30); i++) {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')!
          await page.render({ canvasContext: ctx, viewport }).promise
          bitmaps.push(await createImageBitmap(canvas))
        }
        if (!cancelled) setPages(bitmaps)
      } catch (e) {
        console.error('Editor error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [open, df?.id])

  // Render page + annotations
  useEffect(() => {
    if (!pages[currentPage] || !canvasRef.current) return
    const canvas = canvasRef.current
    const bitmap = pages[currentPage]
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)

    // Draw saved annotations for this page
    for (const ann of annotations.filter((a) => a.pageIndex === currentPage)) {
      if (ann.type === 'redaction') {
        ctx.fillStyle = 'black'
        ctx.fillRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.width * canvas.width,
          ann.height * canvas.height
        )
      } else if (ann.type === 'highlight') {
        ctx.fillStyle = toCanvasRgba(ann.color, 0.4, DEFAULT_HIGHLIGHT_COLOR)
        ctx.fillRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.width * canvas.width,
          ann.height * canvas.height
        )
      }
    }
  }, [pages, currentPage, annotations])

  const getRelativePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return
    const { x, y } = getRelativePos(e)
    setDrawing({ active: true, startX: x, startY: y, currentX: x, currentY: y })
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const { x, y } = getRelativePos(e)
    setDrawing((d) => d ? { ...d, currentX: x, currentY: y } : null)
  }

  const onMouseUp = () => {
    if (!drawing || !canvasRef.current) return
    const { startX, startY, currentX, currentY } = drawing
    const ann: PageAnnotation = {
      id: generateId(),
      type: tool === 'redact' ? 'redaction' : 'highlight',
      pageIndex: currentPage,
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
      color: tool === 'highlight' ? DEFAULT_HIGHLIGHT_COLOR : undefined,
    }
    setAnnotations((a) => [...a, ann])
    setDrawing(null)
  }

  const saveEdits = () => {
    if (!df) return
    updateDocumentFile(df.id, { annotations })
    closeModal()
  }

  const rotateCurrentDoc = () => {
    if (!df) return
    const newRotation = (df.rotation + 90) % 360
    updateDocumentFile(df.id, { rotation: newRotation })
  }

  if (!df) return null

  const toolBtn = (t: Tool, label: string, icon: string) => (
    <button
      onClick={() => setTool(t)}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors ${
        tool === t ? 'bg-brand-700 text-white' : 'bg-white hover:bg-gray-100 text-gray-600'
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  )

  return (
    <Modal open={open} onClose={closeModal} title={`✏️ עריכה: ${df.name}`} size="full">
      <div className="flex h-full">
        {/* Toolbar */}
        <div className="w-24 flex-shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col items-center gap-2 p-2">
          {toolBtn('select', 'בחר', '↖️')}
          {toolBtn('redact', 'השחרה', '⬛')}
          {toolBtn('highlight', 'הדגשה', '🟡')}
          <hr className="w-full border-gray-200 my-1" />
          <button
            onClick={rotateCurrentDoc}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs bg-white hover:bg-gray-100 text-gray-600 w-full"
          >
            <span className="text-base">🔄</span>
            סיבוב
          </button>
          <hr className="w-full border-gray-200 my-1" />
          <button
            onClick={() => setAnnotations((a) => a.filter((ann) => ann.pageIndex !== currentPage))}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
          >
            נקה עמוד
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-gray-700 flex flex-col items-center p-4 gap-4">
          {pages.length > 1 && (
            <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2 shadow">
              <button
                className="text-sm disabled:opacity-40"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                ← הקודם
              </button>
              <span className="text-sm">עמוד {currentPage + 1} / {pages.length}</span>
              <button
                className="text-sm disabled:opacity-40"
                onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                disabled={currentPage === pages.length - 1}
              >
                הבא →
              </button>
            </div>
          )}

          {loading ? (
            <Spinner size="lg" />
          ) : pages.length === 0 ? (
            <div className="text-gray-400 mt-16">
              {missingData ? 'נתוני הקובץ לא נטענו. שמור וטען את הפרויקט מחדש.' : 'לא ניתן לערוך קובץ זה'}
            </div>
          ) : (
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="shadow-2xl max-w-full"
                style={{
                  cursor: tool === 'select' ? 'default' : 'crosshair',
                  direction: 'ltr',
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
              />
              {/* Drawing preview */}
              {drawing && (
                <div
                  className="absolute pointer-events-none border-2 border-dashed"
                  style={{
                    left: `${Math.min(drawing.startX, drawing.currentX) * 100}%`,
                    top: `${Math.min(drawing.startY, drawing.currentY) * 100}%`,
                    width: `${Math.abs(drawing.currentX - drawing.startX) * 100}%`,
                    height: `${Math.abs(drawing.currentY - drawing.startY) * 100}%`,
                    borderColor: tool === 'redact' ? 'black' : 'gold',
                    backgroundColor: tool === 'redact' ? 'rgba(0,0,0,0.5)' : toCanvasRgba(DEFAULT_HIGHLIGHT_COLOR, 0.3, DEFAULT_HIGHLIGHT_COLOR),
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
        <button onClick={closeModal} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
          ביטול
        </button>
        <button
          onClick={saveEdits}
          className="bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-brand-800"
        >
          שמור שינויים
        </button>
      </div>
    </Modal>
  )
}
