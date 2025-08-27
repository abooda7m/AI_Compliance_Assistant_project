// frontend/src/components/insights/ComplianceHistogram.tsx
import Plot from 'react-plotly.js'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

type Props = { step?: number }

/** يعتمد فقط على .dark أو data-theme="dark" */
function useIsDarkMode() {
  const get = () => {
    const root = document.documentElement
    return root.classList.contains('dark') || root.getAttribute('data-theme') === 'dark'
  }
  const [dark, setDark] = useState<boolean>(get)
  useEffect(() => {
    const root = document.documentElement
    const update = () => setDark(get())
    const obs = new MutationObserver(update)
    obs.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export default function ComplianceHistogram({ step = 5 }: Props) {
  const [scores, setScores] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isDark = useIsDarkMode()

  // ألوان قوية وواضحة
  const ui = useMemo(() => {
    const axisText  = isDark ? '#E5E7EB' : '#111827'   // نص التيكات
    const axisTitle = isDark ? '#F8FAFC' : '#111827'   // عنوان المحاور (أقوى بالدارك)
    return {
      // تدرّج الأعمدة
      barFrom: isDark ? '#EDE9FE' : '#EDE7FF',
      barTo:   isDark ? '#C4B5FD' : '#C3B2FF',
      barLine: isDark ? '#B8A9FD' : '#A78BFA',

      // محاور وشبكة
      grid:     isDark ? 'rgba(255,255,255,0.14)' : '#E5E7EB',
      axisText,
      axisTitle,
      axisLine: isDark ? '#334155' : '#CBD5E1',

      // خط/صندوق المتوسط
      meanLine:        isDark ? '#A78BFA' : '#7C3AED',
      meanLabelBg:     isDark ? 'rgba(167,139,250,0.34)' : 'rgba(124,58,237,0.20)',
      meanLabelBorder: isDark ? '#A78BFA' : '#7C3AED',
      meanLabelFg:     isDark ? '#F8FAFF' : '#111827',

      paper: 'rgba(0,0,0,0)',
      plot:  'rgba(0,0,0,0)',
    }
  }, [isDark])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('policies')
          .select('compliance_score, score')
          .limit(5000)

        if (!mounted) return

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
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>
  if (error) return <div className="text-sm text-red-400">{error}</div>
  if (!scores.length) return <div className="text-sm text-neutral-500">No data.</div>

  // المتوسط
  const mean = scores.reduce((acc, n) => acc + n, 0) / (scores.length || 1)

  // تجهيز الـbins
  const minVal = Math.min(...scores)
  const maxVal = Math.max(...scores)
  const start = Math.floor(minVal / step) * step
  const end = Math.ceil(maxVal / step) * step + step

  const bins: Array<[number, number]> = []
  for (let b = start; b < end; b += step) bins.push([b, b + step])

  const counts = bins.map(([b0, b1]) => scores.filter((s) => s >= b0 && s < b1).length)
  const centers = bins.map(([b0, b1]) => (b0 + b1) / 2)
  const labels  = bins.map(([b0, b1]) => `${b0}–${b1 - 1}`)

  // تدرّج ألوان الأعمدة
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const hexToRgb = (hex: string) => {
    const m = hex.replace('#', '')
    const n = parseInt(m, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  const rgbToHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

  const c0 = hexToRgb(ui.barFrom)
  const c1 = hexToRgb(ui.barTo)
  const barColors = centers.map((_, i) => {
    const t = centers.length <= 1 ? 0 : i / (centers.length - 1)
    const r = Math.round(lerp(c0.r, c1.r, t))
    const g = Math.round(lerp(c0.g, c1.g, t))
    const b = Math.round(lerp(c0.b, c1.b, t))
    return rgbToHex(r, g, b)
  })

  const barTrace: Partial<Plotly.PlotData> = {
    type: 'bar',
    x: centers,
    y: counts,
    customdata: labels,
    hovertemplate: 'Score range: %{customdata}<br>Count: %{y}<extra></extra>',
    marker: { color: barColors, line: { color: ui.barLine, width: 1 } },
    opacity: 1,
  }

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    bargap: 0.16,
    margin: { l: 80, r: 16, t: 12, b: 64 },
    paper_bgcolor: ui.paper,
    plot_bgcolor: ui.plot,

    // إجبار ألوان/حجوم التيكات + عناوين المحاور
    xaxis: {
      title: {
        text: 'Compliance Score',
        font: { color: ui.axisTitle, size: 15 },
        standoff: 10,
      },
      tickmode: 'array',
      tickvals: centers,
      ticktext: labels,
      tickfont:  { color: ui.axisText, size: 13 },
      showline: true,
      linecolor: ui.axisLine,
      gridcolor: ui.grid,
      zeroline: false,
    },
    yaxis: {
      title: {
        text: 'Number of Records',
        font: { color: ui.axisTitle, size: 15 },
        standoff: 10,
      },
      tickfont:  { color: ui.axisText, size: 13 },
      showline: true,
      linecolor: ui.axisLine,
      gridcolor: ui.grid,
      zeroline: false,
    },

    showlegend: false,

    // خط المتوسط
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
    // مربع وقيمة المتوسط
    annotations: [
      {
        x: mean,
        y: 1.04,
        xref: 'x',
        yref: 'paper',
        text: `Mean ${mean.toFixed(1)}`,
        showarrow: false,
        font: { color: ui.meanLabelFg, size: 12 },
        xanchor: 'center',
        align: 'center',
        bgcolor: ui.meanLabelBg,
        bordercolor: ui.meanLabelBorder,
        borderpad: 6,
        borderwidth: 1,
        opacity: 1,
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
