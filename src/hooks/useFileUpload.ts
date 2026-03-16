import { useCallback } from 'react'
import { useStore } from '@/store'
import {
  detectFormat,
  generateId,
  getFileNameWithoutExtension,
} from '@/utils/fileHelpers'
import { saveFileData } from '@/lib/db'
import { extractPageCount } from '@/lib/pageCount'
import type { DocumentFile, AnnexEntry } from '@/types'
import { getAnnexLabel } from '@/utils/numberingUtils'

export function useFileUpload() {
  const {
    addDocumentFile,
    addMainDocument,
    addAnnex,
    mainDocuments,
    annexes,
    settings,
  } = useStore()

  const processFile = useCallback(
    async (file: File, target: 'main' | 'annex') => {
      const id = generateId()
      const format = detectFormat(file)
      const arrayBuffer = await file.arrayBuffer()
      const pages = await extractPageCount(arrayBuffer, format)

      const docFile: DocumentFile = {
        id,
        name: getFileNameWithoutExtension(file.name),
        originalName: file.name,
        format,
        fileSizeBytes: file.size,
        totalPages: pages,
        fileData: arrayBuffer,
        fileDataKey: id,
        annotations: [],
        rotation: 0,
        compressed: false,
      }

      // Save to IndexedDB asynchronously
      saveFileData(id, arrayBuffer).catch(console.error)

      addDocumentFile(docFile)

      if (target === 'main') {
        addMainDocument({
          id: generateId(),
          documentId: id,
          title: docFile.name,
          order: mainDocuments.length,
        })
      } else {
        const annexIndex = annexes.length
        const label = getAnnexLabel(annexIndex, settings.numberingStyle, settings.numberingStartAt)
        const annex: AnnexEntry = {
          id: generateId(),
          documentId: id,
          label,
          description: docFile.name,
          subAnnexes: [],
          order: annexIndex,
        }
        addAnnex(annex)
      }
    },
    [addDocumentFile, addMainDocument, addAnnex, mainDocuments.length, annexes.length, settings]
  )

  const handleFiles = useCallback(
    async (files: FileList | File[], target: 'main' | 'annex') => {
      const fileArray = Array.from(files)
      // Sort alphabetically as default
      fileArray.sort((a, b) => a.name.localeCompare(b.name, 'he'))
      for (const file of fileArray) {
        await processFile(file, target)
      }
    },
    [processFile]
  )

  return { handleFiles }
}
