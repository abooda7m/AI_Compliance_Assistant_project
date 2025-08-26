// src/components/FileDrop.tsx
import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'

type Props = {
  onFiles: (files: FileList | File[] | null) => void
  disabled?: boolean
  accept?: string
}

/** Theme-aware, pretty dropzone. API-compatible with the old component. */
export default function FileDrop({ onFiles, disabled, accept }: Props) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const stop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const onDrop = (e: React.DragEvent) => {
    stop(e)
    setDrag(false)
    if (disabled) return
    const files = e.dataTransfer?.files ?? null
    onFiles(files && files.length ? files : null)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker() }}
      onClick={openPicker}
      onDragEnter={(e) => { stop(e); setDrag(true) }}
      onDragOver={stop}
      onDragLeave={(e) => { stop(e); setDrag(false) }}
      onDrop={onDrop}
      className={[
        'group relative rounded-2xl border-2 border-dashed transition shadow-sm',
        'border-black/15 dark:border-white/15',
        'bg-neutral-50/80 dark:bg-neutral-900/60',
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer hover:border-indigo-400/60 hover:shadow-[0_0_0_3px_rgba(79,70,229,.08)]',
      ].join(' ')}
      style={{ minHeight: 160 }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={disabled}
        accept={accept}
        onChange={(e) => onFiles(e.target.files)}
      />

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 ring-indigo-400/30" />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <div
          className={[
            'inline-flex h-11 w-11 items-center justify-center rounded-full',
            'bg-black/5 text-neutral-700',
            'dark:bg-white/10 dark:text-neutral-200',
            drag ? 'scale-105' : '',
          ].join(' ')}
        >
          <UploadCloud size={22} />
        </div>

        <p className="font-medium text-neutral-800 dark:text-neutral-100">
          Drag &amp; drop your file here
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">PDF, TXT, DOC, DOCX</p>

        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="mt-2 inline-flex h-8 items-center justify-center rounded-full border
                     border-indigo-300/70 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700
                     hover:bg-indigo-100 active:scale-[.99]
                     dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/15
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Choose file
        </button>
      </div>

      {drag && <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500/40" />}
    </div>
  )
}
