import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Row = { violation: string; c: number }

type ParsedViolation = {
  value?: string
  section?: string
  page?: string | number
  explanation?: string
  raw?: string
}

function parseViolation(s: string): ParsedViolation {
  try {
    const obj = JSON.parse(s)
    return {
      value: obj.Value || obj.value || undefined,
      section: obj.Section || obj.section || undefined,
      page: obj.Page || obj.page || undefined,
      explanation: obj.Explanation || obj.explanation || undefined,
    }
  } catch {
    return { raw: s }
  }
}

function trunc(s?: string, n = 120) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/**
 * Top-N violations table with JSON-aware formatting.
 */
export default function TopViolations({ limit = 3 }: { limit?: number }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error } = await supabase
          .from('audit_violations_counter')
          .select('violation, c')
          .order('c', { ascending: false })
          .limit(limit)

        if (error) throw error
        setRows((data ?? []) as Row[])
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load violations')
      } finally {
        setLoading(false)
      }
    })()
  }, [limit])

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>
  if (!rows.length) return <div className="text-sm text-neutral-500">No violations found.</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead className="text-xs uppercase text-neutral-500">
          <tr>
            <th className="text-left py-2 px-3 border-b border-neutral-200 dark:border-neutral-800">#</th>
            <th className="text-left py-2 px-3 border-b border-neutral-200 dark:border-neutral-800">Violation</th>
            <th className="text-right py-2 px-3 border-b border-neutral-200 dark:border-neutral-800">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const p = parseViolation(r.violation)
            const title = p.value || p.raw || '—'
            const meta = [
              p.section ? `Section: ${p.section}` : null,
              p.page != null ? `Page: ${p.page}` : null,
              p.explanation ? `Note: ${trunc(p.explanation)}` : null,
            ].filter(Boolean).join(' • ')
            const fullTooltip = p.raw ? p.raw : JSON.stringify(
              { value: p.value, section: p.section, page: p.page, explanation: p.explanation },
              null,
              2
            )
            return (
              <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="py-2 px-3">{i + 1}</td>
                <td className="py-2 px-3">
                  <div className="font-medium" title={title}>{title}</div>
                  {meta && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap overflow-hidden text-ellipsis" title={fullTooltip}>
                      {meta}
                    </div>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-semibold">{r.c}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
