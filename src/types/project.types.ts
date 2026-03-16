import type { MainDocument, AnnexEntry, DocumentFile } from './document.types'
import type { CompilationSettings } from './settings.types'

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  mainDocuments: MainDocument[]
  annexes: AnnexEntry[]
  documentFiles: Omit<DocumentFile, 'fileData'>[]
  settings: CompilationSettings
}

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: string
}
