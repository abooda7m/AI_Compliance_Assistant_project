// src/pages/Sensitivity.tsx
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Finding = {
  type?: string
  value?: string
  severity?: string
  start?: number
  end?: number
  page?: number
}

type Row = {
  id: string
  document_id: string
  is_sensitive: boolean
  summary?: string
  findings?: Finding[]
  created_at: string
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`badge ${ok ? 'badge-red' : 'badge-green'}`}>
      {ok ? 'Sensitive' : 'Not sensitive'}
    </span>
  )
}

function JsonBlock({ value }: { value: any }) {
  return (
    <pre
      className="rounded border p-2 overflow-x-auto text-xs
                 bg-black/5  border-black/10  text-neutral-800
                 dark:bg-white/10 dark:border-white/10 dark:text-neutral-200"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function SensitivityPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ items: Row[] }>('/reports/sensitivity')
      .then(({ data }) => setRows(data.items || []))
      .catch((e) => setErr(e.message))
  }, [])

  const toggle = (id: string) => setExpanded(cur => (cur === id ? null : id))

  return (
<div className="tab-page card">
      <div className="card-header">
      <h2 className="tab-title">Sensitivity reports</h2>
      </div>

      <div className="card-body space-y-3">
        {err && <div className="text-sm text-rose-500 dark:text-rose-400 mb-2">{err}</div>}

        {rows.map((r) => {
          const isOpen = expanded === r.id
          const list = Array.isArray(r.findings) ? r.findings : []

          return (
            <div
              key={r.id}
              className="rounded-xl border bg-white/70 dark:bg-neutral-900/50
                         border-black/10 dark:border-white/10
                         transition will-change-transform
                         hover:shadow-xl hover:scale-[1.01]
                         hover:border-indigo-400/40 dark:hover:border-indigo-400/30"
            >
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="w-full text-left px-3 py-3 rounded-t-xl flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                    <span className="truncate">{r.document_id}</span>
                    <Badge ok={r.is_sensitive} />
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    {r.summary ||
                      (r.is_sensitive
                        ? 'Sensitive indicators found.'
                        : 'No sensitive indicators detected.')}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {list.length} finding(s)
                  </div>
                </div>

                <div className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </button>

              <div
                className={`${isOpen ? 'block' : 'hidden'} px-3 pb-3 pt-2 border-t border-black/10 dark:border-white/10`}
              >
                {/* Findings table */}
                <div className="mt-2">
                  <div className="font-medium mb-1 text-neutral-800 dark:text-neutral-200">Findings</div>

                  {list.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
                      <table className="w-full text-sm">
                        <thead className="bg-black/[.04] dark:bg-white/[.06] text-neutral-700 dark:text-neutral-200">
                          <tr className="text-left">
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Value</th>
                            <th className="px-3 py-2">Severity</th>
                            <th className="px-3 py-2">Page</th>
                            <th className="px-3 py-2">Pos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10 dark:divide-white/10 text-neutral-900 dark:text-neutral-100">
                          {list.map((f, i) => (
                            <tr key={i} className="bg-white/70 dark:bg-neutral-900/40">
                              <td className="px-3 py-2">{f.type || '—'}</td>
                              <td className="px-3 py-2">
                                <code className="text-xs opacity-90">{f.value || '—'}</code>
                              </td>
                              <td className="px-3 py-2">{f.severity || '—'}</td>
                              <td className="px-3 py-2">{f.page ?? '—'}</td>
                              <td className="px-3 py-2">
                                {(f.start ?? '—')}–{(f.end ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">No findings captured.</div>
                  )}
                </div>

                {/* Raw JSON */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-neutral-600 dark:text-neutral-400">
                    Raw JSON
                  </summary>
                  <JsonBlock value={r} />
                </details>
              </div>
            </div>
          )
        })}

        {rows.length === 0 && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            No sensitivity reports yet.
          </div>
        )}
      </div>
    </div>
  )
}
