// src/components/FileDrop.tsx
// Simple dark-themed dropzone. Accepts an optional `disabled` prop.
// When disabled, interactions are ignored and UI is visually dimmed.

import { useCallback, useState } from 'react'

type Props = {
  // Files selected or dropped
  onFiles: (files: File[]) => void
  // Optional: disable while uploading
  disabled?: boolean
}

export default function FileDrop({ onFiles, disabled = false }: Props) {
  const [dragOver, setDragOver] = useState(false)

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return // ignore when disabled
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files || [])
      if (files.length) onFiles(files)
    },
    [onFiles, disabled]
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return // ignore when disabled
    if (e.target.files) onFiles(Array.from(e.target.files))
  }

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={[
        'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        disabled
          ? 'opacity-60 cursor-not-allowed border-gray-700 bg-[#0b1626]'
          : dragOver
          ? 'border-blue-500 bg-blue-600/10'
          : 'border-gray-700 bg-[#0f172a]',
      ].join(' ')}
      aria-disabled={disabled}
      role="button"
      tabIndex={0}
    >
      {/* Title & subtitle */}
      <p className="mb-1 font-medium text-gray-200">Drag &amp; drop your file here</p>
      <p className="text-sm text-gray-400 mb-4">PDF, TXT, DOC, DOCX</p>

      {/* Hidden input + visible trigger */}
      <input
        id="fileInput"
        type="file"
        className="hidden"
        onChange={onChange}
        accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={disabled}
      />
      <label
        htmlFor="fileInput"
        className={`btn ${disabled ? 'pointer-events-none' : ''}`}
      >
        Choose file
      </label>
    </div>
  )
}
