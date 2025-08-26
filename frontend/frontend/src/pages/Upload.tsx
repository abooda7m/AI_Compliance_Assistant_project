import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'
import { useToast } from '../components/ui/ToastProvider'
import FileDrop from '../components/FileDrop'

type Doc = { id: string; filename: string; created_at: string }

export default function UploadPage() {
  // Documents list
  const [docs, setDocs] = useState<Doc[]>([])
  const [err, setErr] = useState<string | null>(null)

  // Selected file & upload state
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0) // 0..100

  // Per-document action loading states
  const [sensLoading, setSensLoading] = useState<Record<string, boolean>>({})
  const [auditLoading, setAuditLoading] = useState<Record<string, boolean>>({})

  const { toast } = useToast()

  // Load existing documents
  const load = async () => {
    try {
      const { data: d } = await api.get<{ items: Doc[] }>('/reports/documents')
      setDocs(d.items || [])
    } catch (e: any) {
      setErr(e.message || 'Failed to fetch documents')
    }
  }
  useEffect(() => { load() }, [])

  // Format helpers (UI only)
  const prettySize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0, b = bytes
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
    return `${b.toFixed(b >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
  }
  const fileSize = useMemo(() => (file ? prettySize(file.size) : ''), [file])

  // Upload logic (business API unchanged)
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
        // NOTE: Axios progress callback for a smoother UX
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

  // Run sensitivity for a document id
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

  // Run audit for a document id
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
    <div className="space-y-4">
      {/* Upload card */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Upload a document</h2>
        </div>

        <div className="card-body space-y-4">
          {/* Dropzone + manual picker */}
          <FileDrop
            onFiles={(files) => setFile(files?.[0] ?? null)}
            disabled={isUploading}
          />

          {/* Selected file preview + action */}
          {file && (
            <div className="rounded-md border border-gray-700 bg-[#0f172a] p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium text-gray-200">{file.name}</div>
                <div className="text-xs text-gray-400">{file.type || 'unknown'} • {fileSize}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn"
                  onClick={doUpload}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  className="btn-outline"
                  onClick={() => { if (!isUploading) { setFile(null); setProgress(0) } }}
                  disabled={isUploading}
                  title="Clear selected file"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="w-full">
              <div className="h-2 w-full rounded bg-gray-700 overflow-hidden">
                <div
                  className="h-2 bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  role="progressbar"
                />
              </div>
              <div className="mt-1 text-xs text-gray-400">{progress}%</div>
            </div>
          )}

          {/* Error text (if any) */}
          {err && <div className="text-red-400 text-sm">{err}</div>}
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
                <th className="w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const when = d.created_at ? new Date(d.created_at) : null
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="skeleton inline-block h-6 w-6 rounded"></span>
                        <div>
                          <div className="font-medium text-gray-100">{d.filename}</div>
                          <div className="text-xs text-gray-400">ID: {d.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-300">
                      {when ? `${when.toLocaleDateString()} ${when.toLocaleTimeString()}` : '—'}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn-outline flex items-center gap-2"
                          onClick={() => runSens(d.id)}
                          disabled={!!sensLoading[d.id]}
                        >
                          {sensLoading[d.id] ? <Spinner /> : 'Run Sensitivity'}
                          {sensLoading[d.id] && <span className="text-xs">Processing…</span>}
                        </button>
                        <button
                          className="btn-outline flex items-center gap-2"
                          onClick={() => runAudit(d.id)}
                          disabled={!!auditLoading[d.id]}
                        >
                          {auditLoading[d.id] ? <Spinner /> : 'Run Audit'}
                          {auditLoading[d.id] && <span className="text-xs">Processing…</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-gray-400 text-sm py-6 text-center">
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
