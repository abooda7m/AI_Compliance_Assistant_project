import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart3, PieChart, TriangleAlert, ActivitySquare } from 'lucide-react'

import DocumentsByType from '../components/insights/DocumentsByType'
import ViolationsByIndustry from '../components/insights/ViolationsByIndustry'
import ComplianceHistogram from '../components/insights/ComplianceHistogram'
import TopViolations from '../components/insights/TopViolations'
import StatsCards from '../components/insights/StatsCards'

type Row = { industry: string; c: number }

/** Subtle aqua gradient (uniform look) */
function aquaGradient(t: number) {
  // t: 0..1  => very light -> a touch darker
  // Using HSL keeps hue fixed and adjusts lightness slightly for that "official" look
  const l1 = 74 - 8 * t // lighter
  const l2 = 66 - 8 * t // a bit darker
  const c1 = `hsl(190 85% ${l1}%)`
  const c2 = `hsl(190 85% ${l2}%)`
  return `linear-gradient(90deg, ${c1} 0%, ${c2} 100%)`
}

export default function InsightsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
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
  const denom = Math.max(rows.length - 1, 1)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Insights</h1>
      </header>

      {/* quick stats cards */}
      <StatsCards />

      {/* Companies by Industry (uniform aqua with very subtle gradient) */}
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 bg-transparent p-4">
        <div className="mb-4 flex items-center gap-2">
          {/* unified aqua icon for header */}
          <BarChart3 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Companies by Industry
          </h2>
        </div>

        {loading && <div className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</div>}
        {error && <div className="text-sm text-red-500">Error: {error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">No data.</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((r, idx) => {
              const pct = Math.round((r.c / max) * 100)
              // t gives a very slight step across the list
              const t = idx / denom
              const fill = aquaGradient(t)
              return (
                <div key={r.industry}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-neutral-800 dark:text-neutral-300">{r.industry}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">{r.c}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-neutral-200/60 dark:bg-white/10">
                    <div
                      className="h-2 rounded"
                      style={{
                        width: `${pct}%`,
                        background: fill,
                        // a tiny inner shadow for a crisp professional look (still subtle)
                        boxShadow:
                          'inset 0 0 0 1px rgba(255,255,255,0.25), 0 0 0 0.5px rgba(0,0,0,0.10)',
                      }}
                      aria-label={`${r.industry}: ${r.c}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Documents by Type */}
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 bg-transparent p-4">
        <div className="mb-4 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Documents by Type</h2>
        </div>
        <DocumentsByType />
      </div>

      {/* Violations by Industry */}
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 bg-transparent p-4">
        <div className="mb-4 flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Violations by Industry</h2>
        </div>
        <ViolationsByIndustry />
      </div>

      {/* Compliance Score Distribution */}
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 bg-transparent p-4">
        <div className="mb-4 flex items-center gap-2">
          <ActivitySquare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Compliance Score Distribution
          </h2>
        </div>
        <ComplianceHistogram />
      </div>

      {/* Top Violations (Top 3) */}
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 bg-transparent p-4">
        <div className="mb-4 flex items-center gap-2">
          <TriangleAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Top Violations (Top 3)</h2>
        </div>
        <TopViolations limit={3} />
      </div>
    </div>
  )
}
