// frontend/src/components/insights/StatsCards.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Cnts = { organizations: number; companies: number; documents: number }

export default function StatsCards() {
  const [counts, setCounts] = useState<Cnts | null>(null)

  useEffect(() => {
    ;(async () => {
      const tables = ['organizations', 'companies', 'documents'] as const
      const results = await Promise.all(
        tables.map((t) => supabase.from(t).select('*', { head: true, count: 'exact' }))
      )
      const [org, comp, docs] = results
      setCounts({
        organizations: org.count ?? 0,
        companies: comp.count ?? 0,
        documents: docs.count ?? 0,
      })
    })()
  }, [])

  const Card = ({ title, value }: { title: string; value: number | string }) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{title}</div>
      <div className="mt-2 text-3xl font-extrabold text-neutral-900 dark:text-white">{value}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card title="Organizations" value={counts?.organizations ?? '—'} />
      <Card title="Companies" value={counts?.companies ?? '—'} />
      <Card title="Documents" value={counts?.documents ?? '—'} />
    </div>
  )
}
