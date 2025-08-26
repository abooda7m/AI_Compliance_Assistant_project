// frontend/src/components/insights/ViolationsByIndustry.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Rectangle,
} from 'recharts'
import { supabase } from '../../supabaseClient'

type Row = { industry: string | null; violations: number | null }

// Use this for your section icon color in Insights header:
// <TriangleAlert style={{ color: VIOLATION_ICON_COLOR }} ... />
export const VIOLATION_ICON_COLOR = '#FF9A91' // peachy red (works on both themes)

export default function ViolationsByIndustry() {
  const [rows, setRows] = useState<Array<{ industry: string; value: number }>>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from<Row>('violations_by_industry')
          .select('industry, violations')
          .order('violations', { ascending: false })

        if (error) throw error

        const mapped =
          (data ?? []).map((r) => ({
            industry: r.industry ?? 'Unknown',
            value: Number(r.violations ?? 0),
          })) || []

        setRows(mapped)
      } catch (e: any) {
        setError(e?.message || 'Failed to load violations')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Detect dark mode via class on <html> OR system setting
  const isDark = useIsDarkMode()

  // Pastel peach gradient (slightly darker in dark mode)
  const colors = useMemo(() => {
    return {
      from: isDark ? '#FFC7BF' : '#FFDAD4', // very light peach
      mid:  isDark ? '#FFAFA6' : '#FFC1BA', // mid peach
      to:   isDark ? '#FF8F86' : '#FF9A91', // soft red/peach
      rail: isDark ? '#232427' : '#E9ECEF', // track color behind bars
      ticks:isDark ? '#E5E7EB' : '#334155', // axes/labels
      hoverBg: isDark ? 'rgba(255,154,145,0.10)' : 'rgba(255,154,145,0.08)',
      tooltipBg: isDark ? '#0F172A' : '#FFFFFF',
      tooltipBorder: isDark ? '#263040' : '#E5E7EB',
      tooltipFg: isDark ? '#E5E7EB' : '#111827',
    }
  }, [isDark])

  if (loading) return <div className="py-12 text-center text-sm text-neutral-500">Loading…</div>
  if (error)   return <div className="py-12 text-center text-sm text-red-400">{error}</div>
  if (!rows.length) return <div className="py-12 text-center text-sm text-neutral-500">No data.</div>

  return (
    <div className="h-[360px] w-full bg-transparent">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 120 }}
          barCategoryGap={18}
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id="violations-peach" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"  stopColor={colors.from} />
              <stop offset="55%" stopColor={colors.mid} />
              <stop offset="100%" stopColor={colors.to} />
            </linearGradient>
          </defs>

          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            stroke={colors.ticks}
            tick={{ fill: colors.ticks, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="industry"
            width={110}
            axisLine={false}
            tickLine={false}
            stroke={colors.ticks}
            tick={{ fill: colors.ticks, fontSize: 13 }}
          />

          <Tooltip
            cursor={<Rectangle fill={colors.hoverBg} radius={6} />}
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: 8,
              color: colors.tooltipFg,
            }}
            formatter={(v: any) => [String(v), 'Violations']}
            labelFormatter={(label: any) => `Industry: ${label}`}
          />

          {/* The background (rail) behind each bar */}
          <Bar
            dataKey="value"
            fill="url(#violations-peach)"
            radius={[6, 6, 6, 6]}
            background={{ fill: colors.rail, radius: 6 }}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Small hook to keep in sync with theme toggles (class "dark" or system) */
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

    const update = () => {
      setDark(root.classList.contains('dark') || !!mql?.matches)
    }

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
