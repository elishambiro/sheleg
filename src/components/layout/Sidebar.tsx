import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { useProject } from '@/hooks/useProject'
import type { ProjectMeta } from '@/types'

export function Sidebar() {
  const { sidebarOpen, recentProjects, projectName, setProjectName, resetProject, isDirty } = useStore()
  const { saveCurrentProject, openProject, deleteCurrentProject, loadRecents } = useProject()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadRecents()
  }, [])

  if (!sidebarOpen) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveCurrentProject()
    } finally {
      setSaving(false)
    }
  }

  const handleOpen = async (meta: ProjectMeta) => {
    if (isDirty) {
      if (!confirm('יש שינויים שלא נשמרו. האם להמשיך?')) return
    }
    await openProject(meta.id)
  }

  const handleNew = () => {
    if (isDirty) {
      if (!confirm('יש שינויים שלא נשמרו. האם להמשיך?')) return
    }
    resetProject()
  }

  return (
    <div className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col border-l border-gray-800">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="text-lg font-bold text-white">❄️ שלג</div>
        <div className="text-xs text-gray-400">עורך נספחים משפטיים</div>
      </div>

      {/* Project name */}
      <div className="px-3 py-3 border-b border-gray-800">
        <div className="text-xs text-gray-400 mb-1">שם הפרויקט</div>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 rounded-lg border border-gray-700 focus:border-brand-500 outline-none"
          placeholder="שם הפרויקט..."
        />
        {isDirty && <div className="text-xxs text-amber-400 mt-1">● שינויים לא שמורים</div>}
      </div>

      {/* Actions */}
      <div className="px-3 py-3 space-y-1.5 border-b border-gray-800">
        <SidebarBtn icon="➕" label="פרויקט חדש" onClick={handleNew} />
        <SidebarBtn
          icon="💾"
          label={saving ? 'שומר...' : 'שמור פרויקט'}
          onClick={handleSave}
          disabled={saving}
          highlight={isDirty}
        />
      </div>

      {/* Recent projects */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="text-xs text-gray-500 uppercase mb-2">פרויקטים אחרונים</div>
          {recentProjects.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-4">אין פרויקטים שמורים</div>
          ) : (
            <div className="space-y-1">
              {recentProjects.map((meta) => (
                <div
                  key={meta.id}
                  className="group flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => handleOpen(meta)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-300 truncate">{meta.name}</div>
                    <div className="text-xxs text-gray-500">
                      {new Date(meta.updatedAt).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs px-1 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('למחוק פרויקט זה?')) deleteCurrentProject(meta.id)
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-800 text-xxs text-gray-600 text-center">
        v0.1.0 · Sheleg Legal
      </div>
    </div>
  )
}

function SidebarBtn({
  icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50
        ${highlight
          ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
          : 'text-gray-300 hover:bg-gray-800'
        }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}
