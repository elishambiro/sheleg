import type { DocumentFile } from '@/types'
import { loadFileData } from '@/lib/db'

export async function resolveDocumentData(
  file: Pick<DocumentFile, 'fileData' | 'fileDataKey'>
): Promise<ArrayBuffer | null> {
  if (file.fileData) return file.fileData
  if (!file.fileDataKey) return null
  return (await loadFileData(file.fileDataKey)) ?? null
}
