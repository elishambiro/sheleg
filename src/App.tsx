import { useRef, useState, useCallback } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { DocumentArea } from './components/documents/DocumentArea'
import { AnnexTable } from './components/documents/AnnexTable'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { DocumentViewer } from './components/viewer/DocumentViewer'
import { PdfPreviewPanel } from './components/viewer/PdfPreviewPanel'
import { PdfEditorModal } from './components/editor/PdfEditorModal'
import { PageRangeModal } from './components/documents/PageRangeModal'

const MIN_TOP_PCT = 15
const MAX_TOP_PCT = 80
const MIN_PREVIEW_PCT = 15
const MAX_PREVIEW_PCT = 60

export default function App() {
  const [topPct, setTopPct] = useState(40)
  const [previewPct, setPreviewPct] = useState(38)
  const draggingVert = useRef(false)
  const draggingHoriz = useRef(false)
  const rightColRef = useRef<HTMLDivElement>(null)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Vertical divider (between top docs and bottom annexes)
  const onVertDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingVert.current = true

    const onMove = (ev: MouseEvent) => {
      if (!draggingVert.current || !rightColRef.current) return
      const rect = rightColRef.current.getBoundingClientRect()
      const pct = ((ev.clientY - rect.top) / rect.height) * 100
      setTopPct(Math.max(MIN_TOP_PCT, Math.min(MAX_TOP_PCT, pct)))
    }

    const onUp = () => {
      draggingVert.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // Horizontal divider (between preview and docs+annexes)
  const onHorizDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingHoriz.current = true

    const onMove = (ev: MouseEvent) => {
      if (!draggingHoriz.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      // In LTR context: left = preview panel
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setPreviewPct(Math.max(MIN_PREVIEW_PCT, Math.min(MAX_PREVIEW_PCT, pct)))
    }

    const onUp = () => {
      draggingHoriz.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main 3-panel area — LTR so left/right are predictable */}
        <div ref={splitContainerRef} className="flex flex-1 overflow-hidden" style={{ direction: 'ltr' }}>

          {/* Left panel: PDF preview */}
          <div style={{ width: `${previewPct}%`, minWidth: 0 }} className="flex-shrink-0 overflow-hidden p-3 pr-1">
            <PdfPreviewPanel />
          </div>

          {/* Horizontal resizable divider */}
          <div
            className="w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize group"
            onMouseDown={onHorizDividerMouseDown}
          >
            <div className="h-12 w-1 rounded-full bg-gray-300 group-hover:bg-brand-400 transition-colors" />
          </div>

          {/* Right panel: documents (top) + annexes (bottom) */}
          <div
            ref={rightColRef}
            style={{ width: `${100 - previewPct}%`, minWidth: 0, direction: 'rtl' }}
            className="flex flex-col overflow-hidden p-3 pl-1 gap-0"
          >
            {/* Top: Main documents */}
            <div style={{ height: `${topPct}%`, minHeight: 0 }} className="pb-1">
              <DocumentArea />
            </div>

            {/* Vertical resizable divider */}
            <div
              className="h-2 flex-shrink-0 flex items-center justify-center cursor-row-resize group"
              onMouseDown={onVertDividerMouseDown}
            >
              <div className="w-12 h-1 rounded-full bg-gray-300 group-hover:bg-brand-400 transition-colors" />
            </div>

            {/* Bottom: Annex table */}
            <div style={{ height: `${100 - topPct}%`, minHeight: 0 }} className="pt-1">
              <AnnexTable />
            </div>
          </div>

          <SettingsPanel />
        </div>
      </div>

      {/* Modals */}
      <DocumentViewer />
      <PdfEditorModal />
      <PageRangeModal />
    </div>
  )
}
