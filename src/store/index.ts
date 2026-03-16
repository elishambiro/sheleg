import { create } from 'zustand'
import type { DocumentFile, MainDocument, AnnexEntry } from '@/types/document.types'
import type { CompilationSettings } from '@/types/settings.types'
import type { Project, ProjectMeta } from '@/types/project.types'
import { DEFAULT_SETTINGS } from '@/constants/defaults'
import { deleteFileData } from '@/lib/db'
import { normalizeNumberingStyle, relabelAnnexes } from '@/utils/numberingUtils'

export type ModalType =
  | 'editor'
  | 'viewer'
  | 'settings'
  | 'share'
  | 'pageRange'
  | 'newProject'
  | null

export interface ContextMenuState {
  x: number
  y: number
  targetId: string
  targetType: 'main' | 'annex'
}

interface AppState {
  // ── Document data ─────────────────────────────────────────────────────────
  documentFiles: Record<string, DocumentFile>
  mainDocuments: MainDocument[]
  annexes: AnnexEntry[]

  // ── Project ───────────────────────────────────────────────────────────────
  currentProject: Project | null
  recentProjects: ProjectMeta[]
  isDirty: boolean
  projectName: string

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: CompilationSettings

  // ── UI state ──────────────────────────────────────────────────────────────
  activeModal: ModalType
  activeDocumentId: string | null
  isCompiling: boolean
  compilationProgress: number
  sidebarOpen: boolean
  contextMenu: ContextMenuState | null
  settingsPanelOpen: boolean

  // ── Document actions ──────────────────────────────────────────────────────
  addDocumentFile: (file: DocumentFile) => void
  updateDocumentFile: (id: string, updates: Partial<DocumentFile>) => void
  removeDocumentFile: (id: string) => void

  addMainDocument: (doc: MainDocument) => void
  removeMainDocument: (id: string) => void
  reorderMainDocuments: (from: number, to: number) => void

  addAnnex: (annex: AnnexEntry, parentId?: string) => void
  removeAnnex: (id: string) => void
  updateAnnex: (id: string, updates: Partial<AnnexEntry>) => void
  reorderAnnexes: (from: number, to: number) => void
  reorderSubAnnexes: (parentId: string, from: number, to: number) => void

  // ── Project actions ───────────────────────────────────────────────────────
  setProjectName: (name: string) => void
  setCurrentProject: (project: Project | null) => void
  setRecentProjects: (projects: ProjectMeta[]) => void
  markDirty: () => void
  markClean: () => void
  resetProject: () => void

  // ── Settings actions ──────────────────────────────────────────────────────
  updateSettings: (updates: Partial<CompilationSettings>) => void

  // ── UI actions ────────────────────────────────────────────────────────────
  openModal: (modal: ModalType, documentId?: string) => void
  closeModal: () => void
  setCompiling: (isCompiling: boolean, progress?: number) => void
  setCompilationProgress: (progress: number) => void
  toggleSidebar: () => void
  showContextMenu: (ctx: ContextMenuState) => void
  hideContextMenu: () => void
  toggleSettingsPanel: () => void
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

function flattenAnnexDocumentIds(annexes: AnnexEntry[]): string[] {
  const ids: string[] = []
  for (const annex of annexes) {
    ids.push(annex.documentId)
    if (annex.subAnnexes.length > 0) ids.push(...flattenAnnexDocumentIds(annex.subAnnexes))
  }
  return ids
}

function pruneUnusedDocumentFiles(
  documentFiles: Record<string, DocumentFile>,
  mainDocuments: MainDocument[],
  annexes: AnnexEntry[],
  candidateDocumentIds: string[]
): Record<string, DocumentFile> {
  const referencedIds = new Set([
    ...mainDocuments.map((doc) => doc.documentId),
    ...flattenAnnexDocumentIds(annexes),
  ])
  const nextFiles = { ...documentFiles }

  for (const documentId of candidateDocumentIds) {
    if (referencedIds.has(documentId)) continue
    const file = nextFiles[documentId]
    if (file?.fileDataKey) deleteFileData(file.fileDataKey).catch(console.error)
    delete nextFiles[documentId]
  }

  return nextFiles
}

function removeAnnexEntry(
  annexes: AnnexEntry[],
  targetId: string
): { annexes: AnnexEntry[]; removedDocumentIds: string[] } {
  const removedDocumentIds: string[] = []

  const nextAnnexes = annexes
    .filter((annex) => {
      const shouldKeep = annex.id !== targetId
      if (!shouldKeep) removedDocumentIds.push(...flattenAnnexDocumentIds([annex]))
      return shouldKeep
    })
    .map((annex) => {
      const nested = removeAnnexEntry(annex.subAnnexes, targetId)
      removedDocumentIds.push(...nested.removedDocumentIds)
      return nested.removedDocumentIds.length > 0
        ? { ...annex, subAnnexes: nested.annexes }
        : annex
    })

  return { annexes: nextAnnexes, removedDocumentIds }
}

function getRelabeledAnnexes(
  annexes: AnnexEntry[],
  settings: CompilationSettings
): AnnexEntry[] {
  return relabelAnnexes(annexes, settings.numberingStyle, settings.numberingStartAt)
}

export const useStore = create<AppState>((set) => ({
  // ── Initial state ─────────────────────────────────────────────────────────
  documentFiles: {},
  mainDocuments: [],
  annexes: [],
  currentProject: null,
  recentProjects: [],
  isDirty: false,
  projectName: 'פרויקט חדש',
  settings: DEFAULT_SETTINGS,
  activeModal: null,
  activeDocumentId: null,
  isCompiling: false,
  compilationProgress: 0,
  sidebarOpen: true,
  contextMenu: null,
  settingsPanelOpen: false,

  // ── Document actions ──────────────────────────────────────────────────────
  addDocumentFile: (file) =>
    set((s) => ({
      documentFiles: { ...s.documentFiles, [file.id]: file },
      isDirty: true,
    })),

  updateDocumentFile: (id, updates) =>
    set((s) => ({
      documentFiles: {
        ...s.documentFiles,
        [id]: { ...s.documentFiles[id], ...updates },
      },
      isDirty: true,
    })),

  removeDocumentFile: (id) =>
    set((s) => {
      const file = s.documentFiles[id]
      if (file?.fileDataKey) deleteFileData(file.fileDataKey).catch(console.error)
      const { [id]: _, ...rest } = s.documentFiles
      return { documentFiles: rest, isDirty: true }
    }),

  addMainDocument: (doc) =>
    set((s) => ({
      mainDocuments: [...s.mainDocuments, doc],
      isDirty: true,
    })),

  removeMainDocument: (id) =>
    set((s) => {
      const removed = s.mainDocuments.find((doc) => doc.id === id)
      const nextMainDocuments = s.mainDocuments.filter((doc) => doc.id !== id)

      return {
        mainDocuments: nextMainDocuments,
        documentFiles: removed
          ? pruneUnusedDocumentFiles(s.documentFiles, nextMainDocuments, s.annexes, [removed.documentId])
          : s.documentFiles,
        isDirty: true,
      }
    }),

  reorderMainDocuments: (from, to) =>
    set((s) => ({
      mainDocuments: arrayMove(s.mainDocuments, from, to).map((d, i) => ({
        ...d,
        order: i,
      })),
      isDirty: true,
    })),

  addAnnex: (annex, parentId) =>
    set((s) => {
      let nextAnnexes: AnnexEntry[]
      if (!parentId) {
        nextAnnexes = [...s.annexes, annex]
      } else {
        const updateNested = (annexes: AnnexEntry[]): AnnexEntry[] =>
          annexes.map((a) =>
            a.id === parentId
              ? { ...a, subAnnexes: [...a.subAnnexes, annex] }
              : { ...a, subAnnexes: updateNested(a.subAnnexes) }
          )
        nextAnnexes = updateNested(s.annexes)
      }

      return {
        annexes: getRelabeledAnnexes(nextAnnexes, s.settings),
        isDirty: true,
      }
    }),

  removeAnnex: (id) =>
    set((s) => {
      const result = removeAnnexEntry(s.annexes, id)
      const nextAnnexes = getRelabeledAnnexes(result.annexes, s.settings)
      return {
        annexes: nextAnnexes,
        documentFiles: pruneUnusedDocumentFiles(
          s.documentFiles,
          s.mainDocuments,
          nextAnnexes,
          result.removedDocumentIds
        ),
        isDirty: true,
      }
    }),

  updateAnnex: (id, updates) =>
    set((s) => {
      const updateNested = (annexes: AnnexEntry[]): AnnexEntry[] =>
        annexes.map((a) =>
          a.id === id
            ? { ...a, ...updates }
            : { ...a, subAnnexes: updateNested(a.subAnnexes) }
        )
      return { annexes: updateNested(s.annexes), isDirty: true }
    }),

  reorderAnnexes: (from, to) =>
    set((s) => ({
      annexes: getRelabeledAnnexes(
        arrayMove(s.annexes, from, to).map((a, i) => ({
          ...a,
          order: i,
        })),
        s.settings
      ),
      isDirty: true,
    })),

  reorderSubAnnexes: (parentId, from, to) =>
    set((s) => {
      const updateNested = (annexes: AnnexEntry[]): AnnexEntry[] =>
        annexes.map((a) =>
          a.id === parentId
            ? {
                ...a,
                subAnnexes: arrayMove(a.subAnnexes, from, to).map((sa, i) => ({
                  ...sa,
                  order: i,
                })),
              }
            : { ...a, subAnnexes: updateNested(a.subAnnexes) }
        )
      return {
        annexes: getRelabeledAnnexes(updateNested(s.annexes), s.settings),
        isDirty: true,
      }
    }),

  // ── Project actions ───────────────────────────────────────────────────────
  setProjectName: (name) => set({ projectName: name, isDirty: true }),

  setCurrentProject: (project) => set({ currentProject: project }),

  setRecentProjects: (projects) => set({ recentProjects: projects }),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  resetProject: () =>
    set({
      documentFiles: {},
      mainDocuments: [],
      annexes: [],
      currentProject: null,
      isDirty: false,
      projectName: 'פרויקט חדש',
      settings: DEFAULT_SETTINGS,
    }),

  // ── Settings actions ──────────────────────────────────────────────────────
  updateSettings: (updates) =>
    set((s) => {
      const nextSettings = {
        ...s.settings,
        ...updates,
        numberingStyle: normalizeNumberingStyle(
          (updates.numberingStyle ?? s.settings.numberingStyle)
        ),
      }

      const shouldRelabel =
        (updates.numberingStyle !== undefined || updates.numberingStartAt !== undefined) &&
        nextSettings.numberingStyle !== 'manual'

      return {
        settings: nextSettings,
        annexes: shouldRelabel
          ? relabelAnnexes(s.annexes, nextSettings.numberingStyle, nextSettings.numberingStartAt)
          : s.annexes,
        isDirty: true,
      }
    }),

  // ── UI actions ────────────────────────────────────────────────────────────
  openModal: (modal, documentId) =>
    set({ activeModal: modal, activeDocumentId: documentId ?? null }),

  closeModal: () => set({ activeModal: null, activeDocumentId: null }),

  setCompiling: (isCompiling, progress = 0) =>
    set({ isCompiling, compilationProgress: progress }),

  setCompilationProgress: (progress) => set({ compilationProgress: progress }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  showContextMenu: (ctx) => set({ contextMenu: ctx }),
  hideContextMenu: () => set({ contextMenu: null }),

  toggleSettingsPanel: () =>
    set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
}))
