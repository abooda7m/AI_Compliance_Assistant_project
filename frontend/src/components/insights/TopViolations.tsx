// frontend/src/components/insights/TopViolations.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Row = { violation: string; c: number }

/**
 * Renders a simple table with the top-N violations.
 * - Reads from the "audit_violations_counter" view/table.
 * - Default limit is 3 (Top 3).
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

  if (loading) return <div className="text-sm text-neutral-400">Loading…</div>
  if (error) return <div className="text-sm text-red-400">Error: {error}</div>
  if (!rows.length) return <div className="text-sm text-neutral-400">No violations found.</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead className="text-xs uppercase text-neutral-400">
          <tr>
            <th className="text-left py-2 px-3 border-b border-neutral-800">#</th>
            <th className="text-left py-2 px-3 border-b border-neutral-800">Violation</th>
            <th className="text-right py-2 px-3 border-b border-neutral-800">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.violation} className="border-b border-neutral-800">
              <td className="py-2 px-3">{i + 1}</td>
              <td className="py-2 px-3 max-w-[420px] truncate" title={r.violation}>
                {r.violation}
              </td>
              <td className="py-2 px-3 text-right font-semibold">{r.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
