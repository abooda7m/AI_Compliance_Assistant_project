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

// للأيقونة في عنوان القسم
export const VIOLATION_ICON_COLOR = '#FF9A91'

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

  const isDark = useIsDarkMode()

  // ألوان متّزنة + تزامن مع الثيم
  const colors = useMemo(() => {
    return {
      from: isDark ? '#FFC7BF' : '#FFDAD4',
      mid:  isDark ? '#FFAFA6' : '#FFC1BA',
      to:   isDark ? '#FF8F86' : '#FF9A91',
      rail: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      ticks:isDark ? '#E5E7EB' : '#334155',
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
          {/* تدرّج شريط الانتهاكات */}
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
            // مهم: نستخدم var(--chart-text) + نلغي أي شفافية
            tick={{ fill: 'var(--chart-text)', fontSize: 12, fontWeight: 500, opacity: 1 }}
          />
          <YAxis
            type="category"
            dataKey="industry"
            width={110}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-text)', fontSize: 13, fontWeight: 500, opacity: 1 }}
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

          {/* الخلفية (السكة) خلف كل شريط */}
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

/** يراقب تبدّل الثيم (class "dark" أو إعداد النظام) */
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
