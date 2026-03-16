import type { CompilationSettings } from '@/types'

export const DEFAULT_SETTINGS: CompilationSettings = {
  language: 'he',
  includeToc: true,
  includeCoverPage: false,
  autoMarkFirstPage: true,
  annexLabelPosition: 'top-left',
  numberingStyle: 'numeric',
  numberingStartAt: '1',
  volumeStrategy: 'none',
  volumeMaxSizeMb: 25,
  volumeMaxPages: 300,
  design: {
    primaryColor: '#4263eb',
    fontFamily: 'System UI',
    coverTitle: '',
    coverSubtitle: '',
    showPageNumbers: true,
    pageNumberPosition: 'bottom',
  },
}

export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/tiff',
  'text/html',
  'message/rfc822',
]

export const ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls',
  '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif',
  '.html', '.htm', '.msg', '.eml',
]
