import React, { useRef, useState } from 'react'
import { useFileUpload } from '@/hooks/useFileUpload'
import { ACCEPTED_EXTENSIONS } from '@/constants/defaults'

interface DropZoneProps {
  target: 'main' | 'annex'
  className?: string
  children?: React.ReactNode
}

export function DropZone({ target, className = '', children }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleFiles } = useFileUpload()

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer.files
    if (!files.length) return
    setLoading(true)
    try {
      await handleFiles(files, target)
    } finally {
      setLoading(false)
    }
  }

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setLoading(true)
    try {
      await handleFiles(files, target)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div
      className={`relative ${dragging ? 'drop-active' : ''} ${className}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={onFileInput}
        id={`file-input-${target}`}
      />
      {children}
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-600">מעבד קבצים...</span>
          </div>
        </div>
      )}
      {dragging && (
        <div className="absolute inset-0 border-2 border-brand-500 border-dashed rounded-lg bg-brand-50/80 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-brand-700 font-medium text-sm">שחרר להוספה</span>
        </div>
      )}
    </div>
  )
}
