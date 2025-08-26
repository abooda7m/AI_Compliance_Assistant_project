// frontend/src/components/insights/StatsCards.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Stat = { label: string; table: string; value: number }

function StatCard({ label, value }: Stat) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="mt-2 text-4xl font-extrabold tracking-tight">{value}</div>
    </div>
  )
}

/**
 * Fetches quick counts for organizations / companies / documents
 * using head:true + count:exact to avoid downloading rows.
 */
export default function StatsCards() {
  const [stats, setStats] = useState<Stat[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setError(null)

        const tables: Array<{ label: string; table: string }> = [
          { label: 'Organizations', table: 'organizations' },
          { label: 'Companies', table: 'companies' },
          { label: 'Documents', table: 'documents' },
        ]

        const results = await Promise.all(
          tables.map(async (t) => {
            const { count, error } = await supabase
              .from(t.table)
              .select('*', { count: 'exact', head: true })
            if (error) throw error
            return { label: t.label, table: t.table, value: count ?? 0 }
          })
        )

        setStats(results)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load stats')
        setStats([
          { label: 'Organizations', table: 'organizations', value: 0 },
          { label: 'Companies', table: 'companies', value: 0 },
          { label: 'Documents', table: 'documents', value: 0 },
        ])
      }
    })()
  }, [])

  if (error) {
    // Show the cards even when there’s an error, but also surface the message
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Organizations" value={0} />
          <StatCard label="Companies" value={0} />
          <StatCard label="Documents" value={0} />
        </div>
        <div className="text-sm text-red-400">Error: {error}</div>
      </div>
    )
  }

  if (!stats) {
    // Lightweight skeleton
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 animate-pulse"
          >
            <div className="h-3 w-24 bg-neutral-800 rounded" />
            <div className="mt-4 h-8 w-16 bg-neutral-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((s) => (
        <StatCard key={s.table} label={s.label} value={s.value} />
      ))}
    </div>
  )
}
