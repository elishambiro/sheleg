import { describe, it, expect } from 'vitest'
import {
  formatFileSize,
  getFileExtension,
  getFileNameWithoutExtension,
  isImageFormat,
  isPdfFormat,
  isWordFormat,
  isExcelFormat,
} from './fileHelpers'

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('getFileExtension', () => {
  it('returns lowercase extension with dot', () => {
    expect(getFileExtension('document.PDF')).toBe('.pdf')
    expect(getFileExtension('file.docx')).toBe('.docx')
    expect(getFileExtension('image.JPEG')).toBe('.jpeg')
  })

  it('handles files with multiple dots', () => {
    expect(getFileExtension('my.document.pdf')).toBe('.pdf')
  })
})

describe('getFileNameWithoutExtension', () => {
  it('removes extension', () => {
    expect(getFileNameWithoutExtension('document.pdf')).toBe('document')
    expect(getFileNameWithoutExtension('my file.docx')).toBe('my file')
  })

  it('handles files with multiple dots', () => {
    expect(getFileNameWithoutExtension('my.document.pdf')).toBe('my.document')
  })

  it('returns filename as-is when no extension', () => {
    expect(getFileNameWithoutExtension('README')).toBe('README')
  })
})

describe('format predicates', () => {
  it('isImageFormat', () => {
    expect(isImageFormat('jpg')).toBe(true)
    expect(isImageFormat('jpeg')).toBe(true)
    expect(isImageFormat('png')).toBe(true)
    expect(isImageFormat('gif')).toBe(true)
    expect(isImageFormat('tiff')).toBe(true)
    expect(isImageFormat('pdf')).toBe(false)
    expect(isImageFormat('docx')).toBe(false)
  })

  it('isPdfFormat', () => {
    expect(isPdfFormat('pdf')).toBe(true)
    expect(isPdfFormat('docx')).toBe(false)
  })

  it('isWordFormat', () => {
    expect(isWordFormat('docx')).toBe(true)
    expect(isWordFormat('doc')).toBe(true)
    expect(isWordFormat('pdf')).toBe(false)
  })

  it('isExcelFormat', () => {
    expect(isExcelFormat('xlsx')).toBe(true)
    expect(isExcelFormat('xls')).toBe(true)
    expect(isExcelFormat('pdf')).toBe(false)
  })
})
