// frontend/src/pages/Insights.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart3, PieChart, TriangleAlert, ActivitySquare } from 'lucide-react'


import DocumentsByType from '../components/insights/DocumentsByType'
import ViolationsByIndustry from '../components/insights/ViolationsByIndustry'
import ComplianceHistogram from '../components/insights/ComplianceHistogram'
import TopViolations from '../components/insights/TopViolations'
import StatsCards from '../components/insights/StatsCards'   // <-- NEW

type Row = { industry: string; c: number }

export default function InsightsPage() {
  // Card 1: companies_by_industry
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('companies_by_industry')
          .select('industry, c')
          .order('c', { ascending: false })
        if (error) throw error
        setRows((data ?? []) as Row[])
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const max = Math.max(1, ...rows.map((r) => r.c))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Insights</h1>
      </header>

      {/* NEW: quick stats cards (Organizations / Companies / Documents) */}
      <StatsCards />

      {/* Card 1: Companies by Industry */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="text-blue-400" size={18} />
          <h2 className="text-lg font-semibold">Companies by Industry</h2>
        </div>

        {loading && <div className="text-sm text-neutral-400">Loading…</div>}
        {error && <div className="text-sm text-red-400">Error: {error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-sm text-neutral-400">No data.</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((r) => {
              const pct = Math.round((r.c / max) * 100)
              return (
                <div key={r.industry}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-neutral-300">{r.industry}</span>
                    <span className="text-neutral-400">{r.c}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-neutral-800">
                    <div
                      className="h-2 rounded bg-blue-600"
                      style={{ width: `${pct}%` }}
                      aria-label={`${r.industry}: ${r.c}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Card 2: Documents by Type */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <PieChart className="text-emerald-400" size={18} />
          <h2 className="text-lg font-semibold">Documents by Type</h2>
        </div>
        <DocumentsByType />
      </div>

      {/* Card 3: Violations by Industry */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <TriangleAlert className="text-red-400" size={18} />
          <h2 className="text-lg font-semibold">Violations by Industry</h2>
        </div>
        <ViolationsByIndustry />
      </div>

      {/* Card 4: Compliance Score Distribution */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <ActivitySquare className="text-sky-400" size={18} />
          <h2 className="text-lg font-semibold">Compliance Score Distribution</h2>
        </div>
        <ComplianceHistogram colorway={['#60a5fa', '#34d399', '#fbbf24', '#f87171']} />
      </div>

      {/* Card 5: Top Violations (Top 3) */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex items-center gap-2">
          <TriangleAlert className="text-rose-400" size={18} />
          <h2 className="text-lg font-semibold">Top Violations (Top 3)</h2>
        </div>
        <TopViolations limit={3} />
      </div>
    </div>
  )
}
