export type FileFormat = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'jpg' | 'jpeg' | 'png' | 'gif' | 'tiff' | 'html' | 'htm' | 'msg' | 'eml'

export type AnnotationType = 'redaction' | 'highlight'

export interface PageAnnotation {
  id: string
  type: AnnotationType
  pageIndex: number
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export interface PageRange {
  from: number
  to: number
}

export interface DocumentFile {
  id: string
  name: string
  originalName: string
  format: FileFormat
  fileSizeBytes: number
  totalPages: number
  pageRange?: PageRange
  fileData?: ArrayBuffer
  fileDataKey?: string
  annotations: PageAnnotation[]
  rotation: number
  compressed: boolean
}

export interface AnnexEntry {
  id: string
  documentId: string
  label: string
  description: string
  subAnnexes: AnnexEntry[]
  order: number
  manualLabel?: string
}

export interface MainDocument {
  id: string
  documentId: string
  title: string
  order: number
}
