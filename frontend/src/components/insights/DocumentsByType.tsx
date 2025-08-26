// frontend/src/components/insights/DocumentsByType.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Bucket = { type: string; c: number }

export default function DocumentsByType() {
  const [rows, setRows] = useState<Bucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        // Read content_type from documents and aggregate on the client
        const { data, error } = await supabase
          .from('documents')
          .select('content_type')

        if (error) throw error

        const map = new Map<string, number>()
        ;(data ?? []).forEach((r: any) => {
          const k = r?.content_type ?? 'Unknown'
          map.set(k, (map.get(k) || 0) + 1)
        })

        const buckets = Array.from(map, ([type, c]) => ({ type, c }))
          .sort((a, b) => b.c - a.c)

        setRows(buckets)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load documents')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Nice color palette for the segments
  const palette = [
    '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
    '#22d3ee', '#fb923c', '#f472b6', '#4ade80', '#93c5fd',
  ]

  const total = useMemo(
    () => rows.reduce((acc, r) => acc + r.c, 0),
    [rows]
  )

  // Build a conic-gradient string based on the buckets
  const gradient = useMemo(() => {
    if (!rows.length || !total) return 'conic-gradient(#1f2937 0 100%)'
    let offset = 0
    const stops: string[] = []

    rows.forEach((r, i) => {
      const pct = (r.c / total) * 100
      const start = offset
      const end = offset + pct
      const color = palette[i % palette.length]
      stops.push(`${color} ${start}% ${end}%`)
      offset = end
    })
    return `conic-gradient(${stops.join(',')})`
  }, [rows, total])

  if (loading) return <div className="text-sm text-neutral-400">Loading…</div>
  if (error)   return <div className="text-sm text-red-400">Error: {error}</div>
  if (!rows.length) return <div className="text-sm text-neutral-400">No data.</div>

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Donut */}
      <div className="flex items-center justify-center">
        <div className="relative h-56 w-56">
          <div
            className="h-full w-full rounded-full"
            style={{ background: gradient }}
            aria-label="Documents by type"
          />
          {/* inner hole */}
          <div className="absolute inset-6 rounded-full bg-neutral-900 flex items-center justify-center">
            <div className="text-center leading-tight">
              <div className="text-xl font-bold">{total}</div>
              <div className="text-xs text-neutral-400">docs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const color = palette[i % palette.length]
          const pct = total ? Math.round((r.c / total) * 100) : 0
          return (
            <div key={r.type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="text-sm text-neutral-200">{r.type}</span>
              </div>
              <div className="text-sm text-neutral-400">
                {r.c} <span className="ml-1 text-neutral-500">({pct}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
