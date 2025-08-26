import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Row = {
  id: string
  document_id: string
  compliance_score?: number
  coverage_summary?: string
  violations?: any
  used_context?: any
  created_at: string
}

function JsonBlock({ value }: { value: any }) {
  // Render JSON in a light card for transparency/debugging
  return (
    <pre className="bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto text-xs text-gray-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ items: Row[] }>('/reports/audit')
      .then(({ data }) => setRows(data.items || []))
      .catch((e) => setErr(e.message))
  }, [])

  const toggle = (id: string) => setExpanded((cur) => (cur === id ? null : id))

  return (
    <div className="card">
      <div className="card-header"><h2 className="text-lg font-semibold text-gray-800">Audit reports</h2></div>
      <div className="card-body space-y-3">
        {err && <div className="text-red-500 text-sm">{err}</div>}

        {rows.map((r) => {
          const isOpen = expanded === r.id
          return (
            <div key={r.id} className="border border-gray-200 hover:shadow-xl hover:scale-[101%] transition rounded-md">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="w-full text-left px-3 py-2 rounded-t-md flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-gray-800">{r.document_id}</div>
                  <div className="text-sm text-gray-600">
                    Score: <span className="font-medium text-gray-800">{r.compliance_score ?? '—'}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
              </button>

              <div className={`px-3 pb-3 ${isOpen ? 'block' : 'hidden'}`}> 
                {r.coverage_summary && (
                  <div className="text-sm text-gray-600 my-2">{r.coverage_summary}</div>
                )}

                {/* Violations table */}
                <div className="mt-3">
                  <div className="font-medium mb-1 text-gray-800">Violations</div>
                  {Array.isArray(r.violations) && r.violations.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead className="bg-gray-50">
                          <tr className="text-left">
                            <th className="px-3 py-2">Page</th>
                            <th className="px-3 py-2">Issue</th>
                            <th className="px-3 py-2">Explanation</th>
                            <th className="px-3 py-2">Regulation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.violations.map((v: any, i: number) => {
                            const page = v?.page ?? '—'
                            const issue = v?.value ?? v?.rule_id ?? v?.clause ?? v?.title ?? 'Issue'
                            const explanation = v?.explanation ?? v?.description ?? '—'
                            let regulation: any = '—'
                            if (v?.regulation_citation) regulation = v.regulation_citation
                            else if (v?.regulation) regulation = v.regulation
                            else if (Array.isArray(v?.references) && v.references.length > 0) regulation = v.references.join(', ')
                            return (
                              <tr key={i} className="border-t border-gray-200 align-top">
                                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{page}</td>
                                <td className="px-3 py-2 text-sm text-gray-800 font-medium">{issue}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{explanation}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{regulation}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">No explicit violations captured.</div>
                  )}
                </div>

                {/* Citations / used context */}
                <div className="mt-3">
                  <div className="font-medium mb-1 text-gray-800">Citations / used context</div>
                  {r.used_context ? <JsonBlock value={r.used_context} /> : (
                    <div className="text-xs text-gray-500">None recorded.</div>
                  )}
                </div>

                {/* Raw JSON (toggle to debug structures if needed) */}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-gray-500">Raw JSON</summary>
                  <JsonBlock value={r} />
                </details>
              </div>
            </div>
          )
        })}

        {rows.length === 0 && <div className="text-sm text-gray-500">No audit reports yet.</div>}
      </div>
    </div>
  )
}
