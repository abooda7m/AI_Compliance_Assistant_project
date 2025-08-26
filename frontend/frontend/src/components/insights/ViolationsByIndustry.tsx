// frontend/src/components/insights/ViolationsByIndustry.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Row = { industry: string | null; violations: number | null }

export default function ViolationsByIndustry() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('violations_by_industry')
          .select('industry, violations')
          .order('violations', { ascending: false })

        if (error) throw error
        setRows((data ?? []) as Row[])
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const max = Math.max(1, ...rows.map(r => (r.violations ?? 0)))

  if (loading) return <div className="text-sm text-neutral-400">Loading…</div>
  if (error) return <div className="text-sm text-red-400">Error: {error}</div>
  if (!rows.length) return <div className="text-sm text-neutral-400">No data.</div>

  return (
    <div className="space-y-3">
      {rows.map((r, idx) => {
        const name = r.industry ?? 'Unknown'
        const val = r.violations ?? 0
        const pct = Math.round((val / max) * 100)
        return (
          <div key={`${name}-${idx}`}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-neutral-300">{name}</span>
              <span className="text-neutral-400">{val}</span>
            </div>
            <div className="h-2 w-full rounded bg-neutral-800">
              <div
                className="h-2 rounded bg-red-500"
                style={{ width: `${pct}%` }}
                aria-label={`${name}: ${val}`}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
