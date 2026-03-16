import type { FileFormat } from '@/types'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase()
}

export function getFileNameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(0, lastDot) : filename
}

export function detectFormat(file: File): FileFormat {
  const ext = getFileExtension(file.name)
  const mime = file.type.toLowerCase()

  if (ext === '.pdf' || mime === 'application/pdf') return 'pdf'
  if (ext === '.docx' || mime.includes('wordprocessingml')) return 'docx'
  if (ext === '.doc' || mime === 'application/msword') return 'doc'
  if (ext === '.xlsx' || mime.includes('spreadsheetml')) return 'xlsx'
  if (ext === '.xls' || mime === 'application/vnd.ms-excel') return 'xls'
  if (ext === '.jpg' || ext === '.jpeg' || mime === 'image/jpeg') return 'jpg'
  if (ext === '.png' || mime === 'image/png') return 'png'
  if (ext === '.gif' || mime === 'image/gif') return 'gif'
  if (ext === '.tiff' || ext === '.tif' || mime === 'image/tiff') return 'tiff'
  if (ext === '.html' || ext === '.htm' || mime === 'text/html') return 'html'
  if (ext === '.msg') return 'msg'
  if (ext === '.eml' || mime === 'message/rfc822') return 'eml'
  return 'pdf'
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function isImageFormat(format: FileFormat): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'tiff'].includes(format)
}

export function isPdfFormat(format: FileFormat): boolean {
  return format === 'pdf'
}

export function isWordFormat(format: FileFormat): boolean {
  return format === 'docx' || format === 'doc'
}

export function isExcelFormat(format: FileFormat): boolean {
  return format === 'xlsx' || format === 'xls'
}
