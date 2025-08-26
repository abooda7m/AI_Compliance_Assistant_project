// src/pages/Upload.tsx
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../components/ui/ToastProvider'
import FileDrop from '../components/FileDrop'
import { Loader2 } from 'lucide-react'

type Doc = { id: string; filename: string; created_at: string }

export default function UploadPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [err, setErr] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const [sensLoading, setSensLoading] = useState<Record<string, boolean>>({})
  const [auditLoading, setAuditLoading] = useState<Record<string, boolean>>({})

  const { toast } = useToast()

  const load = async () => {
    try {
      const { data: d } = await api.get<{ items: Doc[] }>('/reports/documents')
      setDocs(d.items || [])
    } catch (e: any) {
      setErr(e.message || 'Failed to fetch documents')
    }
  }
  useEffect(() => { load() }, [])

  const prettySize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0, b = bytes
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
    return `${b.toFixed(b >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
  }
  const fileSize = useMemo(() => (file ? prettySize(file.size) : ''), [file])

  const doUpload = async () => {
    if (!file || isUploading) return
    setErr(null)
    setIsUploading(true)
    setProgress(0)

    const fd = new FormData()
    fd.append('file', file)

    try {
      await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (!evt.total) return
          const pct = Math.round((evt.loaded / evt.total) * 100)
          setProgress(pct)
        },
      })
      toast({ title: 'Upload complete', description: `${file.name} uploaded successfully.`, variant: 'success' })
      setFile(null)
      setProgress(0)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Upload failed')
      toast({ title: 'Upload failed', description: e?.message || 'Could not upload file.', variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const runSens = async (id: string) => {
    setSensLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await api.get('/sensitivity', { params: { file_id: id } })
      toast({ title: 'Sensitivity complete', description: 'Your report is ready.', variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Sensitivity failed', description: e?.message || 'Error running sensitivity.', variant: 'destructive' })
    } finally {
      setSensLoading((prev) => ({ ...prev, [id]: false }))
      await load()
    }
  }

  const runAudit = async (id: string) => {
    setAuditLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await api.get('/audit', { params: { file_id: id } })
      toast({ title: 'Audit complete', description: 'Your report is ready.', variant: 'success' })
    } catch (e: any) {
      toast({ title: 'Audit failed', description: e?.message || 'Error running audit.', variant: 'destructive' })
    } finally {
      setAuditLoading((prev) => ({ ...prev, [id]: false }))
      await load()
    }
  }

  return (
<div className="tab-page tab-stack">
      {/* Upload card */}
      <div className="card">
        <div className="card-header">
          <h2 className="tab-title">Upload a document</h2>
        </div>

        <div className="card-body space-y-4">
          <FileDrop onFiles={(files) => setFile(files?.[0] ?? null)} disabled={isUploading} />

          {file && (
            <div
              className="rounded-xl border p-4 flex items-center justify-between gap-3
                         bg-black/5 text-neutral-900 border-black/10
                         dark:bg-white/10 dark:text-neutral-100 dark:border-white/10"
            >
              <div className="text-sm">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  {file.type || 'unknown'} • {fileSize}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={doUpload}
                  disabled={isUploading}
                  className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold
                             text-white bg-indigo-600 hover:bg-indigo-600/90
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading…' : 'Upload'}
                </button>

                <button
                  type="button"
                  onClick={() => { if (!isUploading) { setFile(null); setProgress(0) } }}
                  disabled={isUploading}
                  title="Clear selected file"
                  className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium
                             border border-indigo-500 text-indigo-600 bg-transparent hover:bg-indigo-50
                             dark:text-indigo-300 dark:border-indigo-400/60 dark:hover:bg-white/5
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="w-full">
              <div className="h-2 w-full rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
                <div
                  className="h-2 bg-indigo-600 transition-all"
                  style={{ width: `${progress}%` }}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  role="progressbar"
                />
              </div>
              <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{progress}%</div>
            </div>
          )}

          {err && <div className="text-rose-500 dark:text-rose-400 text-sm">{err}</div>}
        </div>
      </div>

      {/* Recent uploads */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium">Recent uploads</h3>
        </div>

        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th className="w-48">Uploaded</th>
                <th className="w-64">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const when = d.created_at ? new Date(d.created_at) : null
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="skeleton inline-block h-6 w-6 rounded" />
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-neutral-100">{d.filename}</div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">ID: {d.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-neutral-700 dark:text-neutral-300">
                      {when ? `${when.toLocaleDateString()} ${when.toLocaleTimeString()}` : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                        <button
                          type="button"
                          onClick={() => runSens(d.id)}
                          disabled={!!sensLoading[d.id]}
                          aria-live="polite"
                          className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-medium
                                     border border-indigo-500 text-indigo-600 bg-transparent hover:bg-indigo-50
                                     dark:text-indigo-300 dark:border-indigo-400/60 dark:hover:bg-white/5
                                     disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {sensLoading[d.id]
                            ? (<><Loader2 className="animate-spin" size={16} /><span>Processing…</span></>)
                            : 'Run Sensitivity'}
                        </button>

                        <button
                          type="button"
                          onClick={() => runAudit(d.id)}
                          disabled={!!auditLoading[d.id]}
                          aria-live="polite"
                          className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-medium
                                     border border-indigo-500 text-indigo-600 bg-transparent hover:bg-indigo-50
                                     dark:text-indigo-300 dark:border-indigo-400/60 dark:hover:bg-white/5
                                     disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {auditLoading[d.id]
                            ? (<><Loader2 className="animate-spin" size={16} /><span>Processing…</span></>)
                            : 'Run Audit'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-neutral-600 dark:text-neutral-400 text-sm py-6 text-center">
                    No uploads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
