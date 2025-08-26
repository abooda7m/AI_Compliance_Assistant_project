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
    <span className={`badge ${ok ? 'badge-red' : 'badge-green'}`}>{
      ok ? 'Sensitive' : 'Not sensitive'
    }</span>
  )
}

function JsonBlock({ value }: { value: any }) {
  return (
    <pre className="bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-xs text-gray-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function SensitivityPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ items: Row[] }>('/reports/sensitivity')
      .then(({ data }) => setRows(data.items || []))
      .catch((e) => setErr(e.message))
  }, [])

  const toggle = (id: string) => setExpanded(cur => cur === id ? null : id)

  return (
    <div className="card">
      <div className="card-header"><h2 className="text-lg font-semibold">Sensitivity reports</h2></div>
      <div className="card-body space-y-3">
        {err && <div className="text-red-400 text-sm mb-2">{err}</div>}

        {rows.map((r) => {
          const isOpen = expanded === r.id
          const list = Array.isArray(r.findings) ? r.findings : []
          return (
            <div key={r.id} className="border border-gray-200 hover:shadow-xl hover:scale-[101%] transition rounded-md">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="w-full text-left px-3 py-2 rounded-t-md flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2 text-gray-800">
                    {r.document_id} <Badge ok={r.is_sensitive} />
                  </div>
                  <div className="text-sm text-gray-600">
                    {r.summary || (r.is_sensitive ? 'Sensitive indicators found.' : 'No sensitive indicators detected.')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{list.length} finding(s)</div>
                </div>
                <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
              </button>

              <div className={`px-3 pb-3 ${isOpen ? 'block' : 'hidden'}`}>
                {/* Findings table/list */}
                <div className="mt-3">
                  <div className="font-medium mb-1">Findings</div>
                  {list.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead className="bg-gray-50">
                          <tr className="text-left">
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Value</th>
                            <th className="px-3 py-2">Severity</th>
                            <th className="px-3 py-2">Page</th>
                            <th className="px-3 py-2">Pos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((f, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              <td className="px-3 py-2 text-sm text-gray-700">{f.type || '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-700"><code className="text-xs">{f.value || '—'}</code></td>
                              <td className="px-3 py-2 text-sm text-gray-700">{f.severity || '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-700">{f.page ?? '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-700">{(f.start ?? '—')}–{(f.end ?? '—')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">No findings captured.</div>
                  )}
                </div>

                {/* Raw JSON for transparency/debug */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-gray-500">Raw JSON</summary>
                  <JsonBlock value={r} />
                </details>
              </div>
            </div>
          )
        })}

        {rows.length === 0 && <div className="text-sm text-gray-500">No sensitivity reports yet.</div>}
      </div>
    </div>
  )
}
