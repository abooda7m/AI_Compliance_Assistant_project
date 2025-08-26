import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'

// DashboardSummary type defines the shape of data returned from /stats
type DashboardSummary = {
  companies: number
  sensitivity_reports: number
  audit_reports: number
  violations: number
}

/**
 * Dashboard page shows high‑level statistics about the organisation.
 *
 * It fetches aggregated counts from the backend and renders them in
 * responsive cards.  Loading and error states are handled gracefully
 * using a spinner and an error message.  Additional helper text
 * describes what each metric represents.
 */
export default function Dashboard() {
  const [stats, setStats] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get<DashboardSummary>('/stats')
      .then(({ data }) => {
        if (!cancelled) setStats(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="container-max space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      {!stats && !error && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Companies"
            value={stats.companies}
            description="Total registered companies"
          />
          <SummaryCard
            title="Sensitivity reports"
            value={stats.sensitivity_reports}
            description="Reports identifying sensitive data"
          />
          <SummaryCard
            title="Audit reports"
            value={stats.audit_reports}
            description="Completed compliance audits"
          />
          <SummaryCard
            title="Violations"
            value={stats.violations}
            description="Total issues found across audits"
          />
        </div>
      )}
      {/* Guidance on using the platform */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-800">Getting started</h2>
        </div>
        <div className="card-body">
          <p className="mb-3">
            Use the navigation to upload documents, check sensitivity, run audits and build policy plans.  The cards above refresh automatically as you generate more reports.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li><strong>Upload:</strong> Add files for analysis.</li>
            <li><strong>Sensitivity:</strong> Detect personal data using rules and the LLM.</li>
            <li><strong>Audit:</strong> Evaluate compliance and view violations.</li>
            <li><strong>Policies:</strong> Compose or revise policies based on results.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <div className="card text-center">
      <div className="card-header"><h3 className="text-base font-medium text-gray-700">{title}</h3></div>
      <div className="card-body flex flex-col items-center justify-center">
        <div className="text-4xl font-bold text-blue-600">{value}</div>
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      </div>
    </div>
  )
}