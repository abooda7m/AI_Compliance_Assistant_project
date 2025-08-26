import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '../../supabaseClient'

/* ---- Cyan like Companies-by-Industry + pastel set ---- */
const CYAN_BASE = '#5AD9E6' // same vibe as bars (pastel cyan)
const LAVENDER_BASE = '#CDBDF4' // pastel lavender
const PEACH_BASE = '#F7C9C1' // pastel peach
const FALLBACKS = ['#BEE0F5', '#D7F2EE', '#F9E7D0', '#E9D7FB']

/* Map fixed colors per known type */
const TYPE_BASES: Record<string, string> = {
  'application/pdf': CYAN_BASE, // cyan — like Companies by Industry
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    LAVENDER_BASE,
  'text/plain': PEACH_BASE,
}

/* Export for the title icon tint */
export const DOCS_ICON_COLOR = CYAN_BASE

/* Simple color blender (0..1) */
function mix(aHex: string, bHex: string, p: number) {
  const a = aHex.replace('#', '')
  const b = bHex.replace('#', '')
  const ar = parseInt(a.slice(0, 2), 16)
  const ag = parseInt(a.slice(2, 4), 16)
  const ab = parseInt(a.slice(4, 6), 16)
  const br = parseInt(b.slice(0, 2), 16)
  const bg = parseInt(b.slice(2, 4), 16)
  const bb = parseInt(b.slice(4, 6), 16)
  const rr = Math.round(ar + (br - ar) * p)
  const rg = Math.round(ag + (bg - ag) * p)
  const rb = Math.round(ab + (bb - ab) * p)
  return `#${rr.toString(16).padStart(2, '0')}${rg
    .toString(16)
    .padStart(2, '0')}${rb.toString(16).padStart(2, '0')}`
}

function useColorMode(): 'light' | 'dark' {
  const get = () =>
    document.documentElement.classList.contains('dark') ||
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  const [m, setM] = useState<'light' | 'dark'>(get)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setM(get())
    mql.addEventListener?.('change', on)
    const obs = new MutationObserver(on)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      mql.removeEventListener?.('change', on)
      obs.disconnect()
    }
  }, [])
  return m
}

type Row = { content_type: string | null }

export default function DocumentsByType() {
  const [data, setData] = useState<{ type: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const mode = useColorMode()

  const theme = useMemo(() => {
    const dark = mode === 'dark'
    return {
      surface: dark ? '#0b0f16' : '#ffffff',
      border: dark ? '#1f2937' : '#e5e7eb',
      fg: dark ? '#e5e7eb' : '#111827',
      stroke: dark ? '#0b1220' : '#e5e7eb',
      lighten: dark ? 0.20 : 0.38, // inner lighten
      darken: dark ? 0.25 : 0.12, // rim darken
    }
  }, [mode])

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.from<Row>('documents').select('content_type')
      const map = new Map<string, number>()
      if (!error && data) {
        data.forEach((r) => {
          const k = r.content_type || 'Unknown'
          map.set(k, (map.get(k) || 0) + 1)
        })
      }
      setData(Array.from(map, ([type, value]) => ({ type, value })))
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: theme.fg }}>Loading…</div>
  if (!data.length) return <div className="py-12 text-center text-sm" style={{ color: theme.fg }}>No data.</div>

  const baseFor = (t: string, i: number) =>
    TYPE_BASES[t] ?? FALLBACKS[i % FALLBACKS.length]
  const idFor = (t: string, i: number) =>
    `docsGrad_${i}_${t.replace(/[^a-z0-9]/gi, '_')}`

  return (
    <div className="h-[320px] w-full bg-transparent">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.map((d, i) => {
              const base = baseFor(d.type, i)
              const inner = mix(base, '#ffffff', theme.lighten)
              const rim = mix(base, '#000000', theme.darken)
              return (
                <radialGradient id={idFor(d.type, i)} key={idFor(d.type, i)}>
                  <stop offset="0%" stopColor={inner} />
                  <stop offset="60%" stopColor={base} />
                  <stop offset="100%" stopColor={rim} />
                </radialGradient>
              )
            })}
          </defs>

          <Pie
            data={data}
            dataKey="value"
            nameKey="type"
            innerRadius={74}
            outerRadius={114}
            paddingAngle={2}
            isAnimationActive={false}
            stroke={theme.stroke}
            strokeWidth={1}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={`url(#${idFor(d.type, i)})`} />
            ))}
          </Pie>

          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            wrapperStyle={{ outline: 'none' }}
            contentStyle={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              color: theme.fg,
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ color: theme.fg, fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
