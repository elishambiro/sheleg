import { useStore } from '@/store'
import { DropZone } from './DropZone'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatFileSize } from '@/utils/fileHelpers'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function MainDocRow({ id, docId }: { id: string; docId: string }) {
  const { documentFiles, removeMainDocument, openModal } = useStore()
  const df = documentFiles[docId]

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (!df) return null

  const icons: Record<string, string> = {
    pdf: '📄',
    docx: '📝',
    doc: '📝',
    xlsx: '📊',
    xls: '📊',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    html: '🌐',
    htm: '🌐',
  }
  const icon = icons[df.format] ?? '📄'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-brand-300 hover:shadow-sm transition-all group"
    >
      <button
        className="cursor-grab text-gray-300 hover:text-gray-500 px-1"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="text-lg">{icon}</span>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onDoubleClick={() => openModal('viewer', docId)}
      >
        <div className="text-sm font-medium text-gray-800 truncate">{df.name}</div>
        <div className="text-xs text-gray-400">
          {df.totalPages > 0 ? `${df.totalPages} עמ'` : 'עמודים לא ידועים'} •{' '}
          {formatFileSize(df.fileSizeBytes)}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-1 text-gray-400 hover:text-brand-600 rounded"
          onClick={() => openModal('viewer', docId)}
          title="צפייה"
        >
          👁
        </button>
        <button
          className="p-1 text-gray-400 hover:text-red-500 rounded"
          onClick={() => removeMainDocument(id)}
          title="מחיקה"
        >
          🗑
        </button>
      </div>
    </div>
  )
}

export function DocumentArea() {
  const { mainDocuments, reorderMainDocuments } = useStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const fromIdx = mainDocuments.findIndex((d) => d.id === active.id)
    const toIdx = mainDocuments.findIndex((d) => d.id === over.id)
    if (fromIdx !== -1 && toIdx !== -1) reorderMainDocuments(fromIdx, toIdx)
  }

  return (
    <DropZone
      target="main"
      className="h-full flex flex-col border border-gray-200 rounded-xl bg-gray-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">📋 מסמכים עיקריים</span>
          {mainDocuments.length > 0 && (
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
              {mainDocuments.length}
            </span>
          )}
        </div>
        <label htmlFor="file-input-main" className="bg-brand-700 hover:bg-brand-800 text-white px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors">
          הוספה
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {mainDocuments.length === 0 ? (
          <EmptyState
            icon="📋"
            title="גרור מסמכים עיקריים לכאן"
            description="כתב טענות, תצהירים, הסכמים..."
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={mainDocuments.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {mainDocuments.map((doc) => (
                  <MainDocRow key={doc.id} id={doc.id} docId={doc.documentId} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </DropZone>
  )
}
