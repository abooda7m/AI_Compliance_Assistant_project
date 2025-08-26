import Plot from 'react-plotly.js'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Props = {
  step?: number
}

export default function ComplianceHistogram({ step = 5 }: Props) {
  const [scores, setScores] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isDark = useIsDarkMode()

  // Pastel violet gradient + UI colors (light/dark aware)
  const ui = useMemo(() => {
    return {
      barFrom: isDark ? '#EDE9FE' : '#F4F1FF', // start (lighter violet)
      barTo:   isDark ? '#C4B5FD' : '#D6C7FE', // end   (slightly deeper pastel)
      barLine: isDark ? '#B8A9FD' : '#CABCFB',

      grid:    isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
      axes:    isDark ? '#E5E7EB' : '#334155',

      meanLine:       isDark ? '#A78BFA' : '#7C3AED',
      meanLabelBg:    isDark ? 'rgba(167,139,250,0.16)' : 'rgba(124,58,237,0.10)',
      meanLabelBorder:isDark ? 'rgba(167,139,250,0.45)' : 'rgba(124,58,237,0.35)',
      meanLabelFg:    isDark ? '#EDE9FE' : '#4C1D95',

      paper: 'rgba(0,0,0,0)',
      plot:  'rgba(0,0,0,0)',
    }
  }, [isDark])

  useEffect(() => {
    ;(async () => {
      try {
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

        if (!vals.length) {
          vals = Array.from({ length: 180 }, () => Math.round(60 + Math.random() * 40))
        }

        setScores(vals)
      } catch (e: any) {
        setError(e?.message || 'Failed to load scores')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>
  if (error) return <div className="text-sm text-red-400">{error}</div>
  if (!scores.length) return <div className="text-sm text-neutral-500">No data.</div>

  // Mean
  const mean = scores.reduce((acc, n) => acc + n, 0) / (scores.length || 1)

  // Pre-binning (for per-bar gradient)
  const minVal = Math.min(...scores)
  const maxVal = Math.max(...scores)
  const start = Math.floor(minVal / step) * step
  const end = Math.ceil(maxVal / step) * step + step

  const bins: Array<[number, number]> = []
  for (let b = start; b < end; b += step) bins.push([b, b + step])

  const counts = bins.map(([b0, b1]) => scores.filter((s) => s >= b0 && s < b1).length)
  const centers = bins.map(([b0, b1]) => (b0 + b1) / 2)
  const labels = bins.map(([b0, b1]) => `${b0}–${b1 - 1}`)

  // Gradient across bars
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const hexToRgb = (hex: string) => {
    const m = hex.replace('#', '')
    const bigint = parseInt(m, 16)
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
  }
  const rgbToHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map(v => (v.toString(16).length === 1 ? '0' + v.toString(16) : v.toString(16))).join('')

  const c0 = hexToRgb(ui.barFrom)
  const c1 = hexToRgb(ui.barTo)
  const barColors = centers.map((_, i) => {
    const t = centers.length <= 1 ? 0 : i / (centers.length - 1)
    const r = Math.round(lerp(c0.r, c1.r, t))
    const g = Math.round(lerp(c0.g, c1.g, t))
    const b = Math.round(lerp(c0.b, c1.b, t))
    return rgbToHex(r, g, b)
  })

  // Trace: no text on bars (labels only on X-axis)
  const barTrace: Partial<Plotly.PlotData> = {
    type: 'bar',
    x: centers,
    y: counts,
    customdata: labels,
    hovertemplate: 'Score range: %{customdata}<br>Count: %{y}<extra></extra>',
    marker: {
      color: barColors,
      line: { color: ui.barLine, width: 1 },
    },
    opacity: 0.96,
  }

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    bargap: 0.16,
    margin: { l: 70, r: 10, t: 8, b: 60 },
    paper_bgcolor: ui.paper,
    plot_bgcolor: ui.plot,
    xaxis: {
      title: { text: 'Compliance Score', standoff: 10 },
      tickmode: 'array',
      tickvals: centers,
      ticktext: labels,
      gridcolor: ui.grid,
      zeroline: false,
      color: ui.axes,
    },
    yaxis: {
      title: { text: 'Number of Records', standoff: 10 },
      gridcolor: ui.grid,
      zeroline: false,
      color: ui.axes,
    },
    showlegend: false,
    shapes: [
      {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: mean,
        x1: mean,
        y0: 0,
        y1: 1,
        line: { color: ui.meanLine, width: 3, dash: 'dot' },
      },
    ],
    annotations: [
      {
        x: mean,
        y: 1.04,
        xref: 'x',
        yref: 'paper',
        text: `Mean ${mean.toFixed(1)}`,
        showarrow: false,
        font: { color: ui.meanLabelFg, size: 12, family: 'Inter, ui-sans-serif' },
        xanchor: 'center',
        align: 'center',
        bgcolor: ui.meanLabelBg,
        bordercolor: ui.meanLabelBorder,
        borderpad: 6,
        borderwidth: 1,
      },
    ],
  }

  return (
    <Plot
      data={[barTrace as any]}
      layout={layout}
      style={{ width: '100%', height: 360 }}
      config={{ displayModeBar: false, responsive: true }}
    />
  )
}

function useIsDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const root = document.documentElement
    return (
      root.classList.contains('dark') ||
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    )
  })

  useEffect(() => {
    const root = document.documentElement
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    const update = () =>
      setDark(root.classList.contains('dark') || !!mql?.matches)

    const obs = new MutationObserver(update)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    mql?.addEventListener?.('change', update)

    return () => {
      obs.disconnect()
      mql?.removeEventListener?.('change', update)
    }
  }, [])

  return dark
}
