import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { DropZone } from './DropZone'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatFileSize } from '@/utils/fileHelpers'
import { getEffectiveAnnexLabel } from '@/utils/numberingUtils'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AnnexEntry } from '@/types'

interface AnnexRowProps {
  annex: AnnexEntry
  depth?: number
}

function AnnexRow({ annex, depth = 0 }: AnnexRowProps) {
  const { documentFiles, removeAnnex, updateAnnex, openModal, settings } = useStore()
  const df = documentFiles[annex.documentId]
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState(annex.description)
  const [labelValue, setLabelValue] = useState(annex.manualLabel ?? annex.label)
  const isManualNumbering = settings.numberingStyle === 'manual'
  const effectiveLabel = getEffectiveAnnexLabel(annex, settings.numberingStyle)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: annex.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  useEffect(() => {
    setDescValue(annex.description)
  }, [annex.description])

  useEffect(() => {
    setLabelValue(annex.manualLabel ?? annex.label)
  }, [annex.manualLabel, annex.label, settings.numberingStyle])

  if (!df) return null

  const icons: Record<string, string> = {
    pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', html: '🌐', htm: '🌐',
  }

  const saveDesc = () => {
    updateAnnex(annex.id, { description: descValue })
    setEditingDesc(false)
  }

  const saveLabel = () => {
    const nextManualLabel = labelValue.trim()
    updateAnnex(annex.id, { manualLabel: nextManualLabel || undefined })
  }

  return (
    <>
      <tr
        ref={setNodeRef}
        style={{ ...style, paddingRight: `${depth * 20}px` }}
        className="border-b border-gray-100 hover:bg-gray-50 group transition-colors"
      >
        {/* Drag handle */}
        <td className="w-8 px-1 text-center">
          <button
            className="cursor-grab text-gray-300 hover:text-gray-500 text-xs px-1"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        </td>

        {/* Label */}
        <td className="w-16 px-2">
          {isManualNumbering ? (
            <input
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
              className="w-full text-xs border border-brand-400 rounded px-1 py-0.5 text-center"
              placeholder={annex.label}
              title="הזן מספור ידני"
            />
          ) : (
            <span
              className="annex-stamp"
              style={{ marginRight: depth > 0 ? `${depth * 12}px` : undefined }}
            >
              {effectiveLabel || '—'}
            </span>
          )}
        </td>

        {/* Icon + filename */}
        <td className="px-2 py-2">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onDoubleClick={() => openModal('viewer', annex.documentId)}
          >
            <span className="text-base">{icons[df.format] ?? '📄'}</span>
            <span className="text-xs text-gray-600 truncate max-w-32">{df.originalName}</span>
          </div>
        </td>

        {/* Description */}
        <td className="px-2 py-2 flex-1">
          {editingDesc ? (
            <input
              autoFocus
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => e.key === 'Enter' && saveDesc()}
              className="w-full text-xs border border-brand-400 rounded px-2 py-1"
            />
          ) : (
            <span
              className="text-xs text-gray-700 cursor-text hover:bg-gray-100 px-1 py-0.5 rounded block truncate"
              onDoubleClick={() => { setDescValue(annex.description); setEditingDesc(true) }}
              title="לחץ פעמיים לעריכה"
            >
              {annex.description || <span className="text-gray-300 italic">הוסף תיאור...</span>}
            </span>
          )}
        </td>

        {/* Pages */}
        <td className="w-16 px-2 text-center">
          <span className="text-xs text-gray-500">
            {df.totalPages > 0 ? df.totalPages : '—'}
          </span>
        </td>

        {/* Size */}
        <td className="w-20 px-2 text-center">
          <span className="text-xs text-gray-500">{formatFileSize(df.fileSizeBytes)}</span>
        </td>

        {/* Actions */}
        <td className="w-24 px-2">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Page range */}
            <button
              className="p-1 text-gray-400 hover:text-brand-600 rounded text-sm"
              title="בחר טווח עמודים"
              onClick={() => openModal('pageRange', annex.documentId)}
            >
              ✂️
            </button>
            {/* Editor */}
            <button
              className="p-1 text-gray-400 hover:text-brand-600 rounded text-sm"
              title="עריכת PDF"
              onClick={() => openModal('editor', annex.documentId)}
            >
              ✏️
            </button>
            {/* Delete */}
            <button
              className="p-1 text-gray-400 hover:text-red-500 rounded text-sm"
              title="מחיקה"
              onClick={() => removeAnnex(annex.id)}
            >
              🗑
            </button>
          </div>
        </td>
      </tr>

      {/* Sub-annexes */}
      {annex.subAnnexes.length > 0 &&
        annex.subAnnexes.map((sub) => (
          <AnnexRow key={sub.id} annex={sub} depth={depth + 1} />
        ))}
    </>
  )
}

export function AnnexTable() {
  const { annexes, reorderAnnexes, openModal } = useStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const fromIdx = annexes.findIndex((a) => a.id === active.id)
    const toIdx = annexes.findIndex((a) => a.id === over.id)
    if (fromIdx !== -1 && toIdx !== -1) reorderAnnexes(fromIdx, toIdx)
  }

  return (
    <DropZone
      target="annex"
      className="h-full flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">📎 נספחים</span>
          {annexes.length > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {annexes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="file-input-annex" className="bg-brand-700 hover:bg-brand-800 text-white px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors">
            הוספה
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {annexes.length === 0 ? (
          <EmptyState
            icon="📎"
            title="גרור נספחים לכאן"
            description="PDF, Word, Excel, תמונות..."
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={annexes.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 sticky top-0">
                    <th className="w-8"></th>
                    <th className="w-16 px-2 py-2 text-right">נספח</th>
                    <th className="px-2 py-2 text-right">קובץ</th>
                    <th className="px-2 py-2 text-right">תיאור</th>
                    <th className="w-16 px-2 py-2 text-center">עמ'</th>
                    <th className="w-20 px-2 py-2 text-center">גודל</th>
                    <th className="w-24 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {annexes.map((annex) => (
                    <AnnexRow key={annex.id} annex={annex} />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </DropZone>
  )
}
