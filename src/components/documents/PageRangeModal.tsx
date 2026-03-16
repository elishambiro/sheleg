import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store'

export function PageRangeModal() {
  const { activeModal, activeDocumentId, closeModal, documentFiles, updateDocumentFile } = useStore()
  const open = activeModal === 'pageRange'
  const df = activeDocumentId ? documentFiles[activeDocumentId] : null

  const [from, setFrom] = useState(df?.pageRange?.from ?? 1)
  const [to, setTo] = useState(df?.pageRange?.to ?? df?.totalPages ?? 1)

  if (!df) return null

  const total = df.totalPages || 999

  const apply = () => {
    const f = Math.max(1, Math.min(from, total))
    const t = Math.max(f, Math.min(to, total))
    if (f === 1 && t === total) {
      updateDocumentFile(df.id, { pageRange: undefined })
    } else {
      updateDocumentFile(df.id, { pageRange: { from: f, to: t } })
    }
    closeModal()
  }

  const clear = () => {
    updateDocumentFile(df.id, { pageRange: undefined })
    closeModal()
  }

  return (
    <Modal open={open} onClose={closeModal} title="✂️ בחירת טווח עמודים" size="sm">
      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-600">
          קובץ: <span className="font-medium">{df.name}</span>
          {df.totalPages > 0 && ` (${df.totalPages} עמ' סה"כ)`}
        </p>

        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">מעמוד</label>
            <input
              type="number"
              min={1}
              max={total}
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              className="w-20 text-sm border rounded-lg px-2 py-1.5 text-center"
            />
          </div>
          <span className="text-gray-400 mt-4">—</span>
          <div>
            <label className="text-xs text-gray-500 block mb-1">עד עמוד</label>
            <input
              type="number"
              min={from}
              max={total}
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="w-20 text-sm border rounded-lg px-2 py-1.5 text-center"
            />
          </div>
        </div>

        {df.pageRange && (
          <p className="text-xs text-amber-600">
            כרגע: עמ' {df.pageRange.from}–{df.pageRange.to}
          </p>
        )}

        <div className="flex gap-2">
          {df.pageRange && (
            <button onClick={clear} className="flex-1 text-sm border border-gray-300 rounded-lg py-2 hover:bg-gray-50">
              הסר הגבלה
            </button>
          )}
          <button
            onClick={apply}
            className="flex-1 bg-brand-700 text-white text-sm rounded-lg py-2 hover:bg-brand-800"
          >
            החל
          </button>
        </div>
      </div>
    </Modal>
  )
}
