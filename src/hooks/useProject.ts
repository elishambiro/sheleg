import { useCallback } from 'react'
import { useStore } from '@/store'
import { saveProject, loadProject, listProjectIds, deleteProject } from '@/lib/db'
import { generateId } from '@/utils/fileHelpers'
import type { Project, ProjectMeta } from '@/types'
import { normalizeNumberingStyle, relabelAnnexes } from '@/utils/numberingUtils'

const RECENT_KEY = 'sheleg-recent-projects'

export function useProject() {
  const store = useStore()

  const getRecentMeta = useCallback((): ProjectMeta[] => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    } catch {
      return []
    }
  }, [])

  const saveRecentMeta = useCallback((projects: ProjectMeta[]) => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(projects))
    store.setRecentProjects(projects)
  }, [store])

  const saveCurrentProject = useCallback(async () => {
    const { documentFiles, mainDocuments, annexes, settings, projectName, currentProject } = store

    const project: Project = {
      id: currentProject?.id ?? generateId(),
      name: projectName,
      createdAt: currentProject?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mainDocuments,
      annexes,
      documentFiles: Object.values(documentFiles).map(({ fileData: _, ...rest }) => rest),
      settings,
    }

    await saveProject(project.id, JSON.stringify(project))

    const meta: ProjectMeta = {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
    }

    const recents = getRecentMeta().filter((r) => r.id !== project.id)
    saveRecentMeta([meta, ...recents].slice(0, 20))

    store.setCurrentProject(project)
    store.markClean()

    return project
  }, [store, getRecentMeta, saveRecentMeta])

  const openProject = useCallback(
    async (id: string) => {
      const json = await loadProject(id)
      if (!json) throw new Error('Project not found')
      const project: Project = JSON.parse(json)
      const normalizedSettings = {
        ...project.settings,
        numberingStyle: normalizeNumberingStyle(project.settings.numberingStyle),
      }
      const normalizedAnnexes = normalizedSettings.numberingStyle === 'manual'
        ? project.annexes
        : relabelAnnexes(project.annexes, normalizedSettings.numberingStyle, normalizedSettings.numberingStartAt)

      store.resetProject()

      // Restore document file metadata (without binary data)
      const fileMap: Record<string, import('@/types').DocumentFile> = {}
      for (const df of project.documentFiles) {
        fileMap[df.id] = { ...df, annotations: df.annotations ?? [], fileData: undefined }
      }

      // Batch state updates
      useStore.setState({
        documentFiles: fileMap,
        mainDocuments: project.mainDocuments,
        annexes: normalizedAnnexes,
        settings: normalizedSettings,
        projectName: project.name,
        currentProject: project,
        isDirty: false,
      })
    },
    [store]
  )

  const deleteCurrentProject = useCallback(
    async (id: string) => {
      await deleteProject(id)
      const recents = getRecentMeta().filter((r) => r.id !== id)
      saveRecentMeta(recents)
    },
    [getRecentMeta, saveRecentMeta]
  )

  const loadRecents = useCallback(async () => {
    const ids = await listProjectIds()
    const meta = getRecentMeta().filter((m) => ids.includes(m.id))
    store.setRecentProjects(meta)
  }, [getRecentMeta, store])

  return { saveCurrentProject, openProject, deleteCurrentProject, loadRecents, getRecentMeta }
}
