// frontend/src/components/insights/ComplianceHistogram.tsx
import Plot from 'react-plotly.js'
import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Props = {
  /** Bar color */
  color?: string
  /** Mean line color */
  meanColor?: string
  /** Median line color */
  medianColor?: string
  /** Bin size (points) */
  step?: number
}

export default function ComplianceHistogram({
  color = '#60a5fa',        // light blue (visible on dark cards)
  meanColor = '#93c5fd',    // softer blue for mean
  medianColor = '#fca5a5',  // soft red for median
  step = 5,
}: Props) {
  const [scores, setScores] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        // Try numeric score from policies table (adjust column names if needed)
        const { data, error } = await supabase
          .from('policies')
          .select('compliance_score, score')
          .limit(5000)

        let vals: number[] = []
        if (!error && data) {
          vals = data
            .map((r: any) => Number(r?.compliance_score ?? r?.score))
            .filter((n) => Number.isFinite(n))
        }

        // Fallback demo values if nothing numeric exists yet
        if (!vals.length) {
          vals = Array.from({ length: 180 }, () =>
            Math.round(60 + Math.random() * 40)
          )
        }

        setScores(vals)
      } catch (e: any) {
        setError(e?.message || 'Failed to load compliance scores')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="text-sm text-neutral-400">Loading…</div>
  if (error)   return <div className="text-sm text-red-400">{error}</div>
  if (!scores.length) return <div className="text-sm text-neutral-400">No data.</div>

  // Mean & median
  const mean =
    scores.reduce((acc, n) => acc + n, 0) / (scores.length || 1)
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  // Binning config (to keep ticks pretty)
  const minVal = Math.min(...scores)
  const maxVal = Math.max(...scores)
  const start = Math.floor(minVal / step) * step
  const end = Math.ceil(maxVal / step) * step

  const data = [
    {
      type: 'histogram' as const,
      x: scores,
      xbins: { start, end, size: step },
      marker: {
        color,
        line: { color: 'rgba(0,0,0,0.25)', width: 1 },
      },
      opacity: 0.9,
      hovertemplate: 'Score: %{x}<br>Count: %{y}<extra></extra>',
      name: 'Scores',
    },
  ]

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    bargap: 0.12,
    margin: { l: 70, r: 10, t: 10, b: 60 },
    // Transparent backgrounds so it blends with your dark card
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      title: { text: 'Compliance Score', standoff: 10 },
      gridcolor: '#293241',
      zeroline: false,
      tick0: start,
      dtick: step,
      color: '#d1d5db',
    },
    yaxis: {
      title: { text: 'Number of Records', standoff: 10 },
      gridcolor: '#293241',
      zeroline: false,
      color: '#d1d5db',
    },
    showlegend: false,
    // Mean & median reference lines
    shapes: [
      {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: mean,
        x1: mean,
        y0: 0,
        y1: 1,
        line: { color: meanColor, width: 2, dash: 'dash' },
      },
      {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: median,
        x1: median,
        y0: 0,
        y1: 1,
        line: { color: medianColor, width: 2, dash: 'dot' },
      },
    ],
    annotations: [
      {
        x: mean,
        y: 1.04,
        xref: 'x',
        yref: 'paper',
        text: `Mean: ${mean.toFixed(1)}`,
        showarrow: false,
        font: { color: meanColor, size: 12 },
        xanchor: 'center',
      },
      {
        x: median,
        y: 1.12,
        xref: 'x',
        yref: 'paper',
        text: `Median: ${median.toFixed(1)}`,
        showarrow: false,
        font: { color: medianColor, size: 12 },
        xanchor: 'center',
      },
    ],
  }

  return (
    <Plot
      data={data as any}
      layout={layout}
      style={{ width: '100%', height: 360 }}
      config={{ displayModeBar: false, responsive: true }}
    />
  )
}
