// frontend/src/components/insights/DocumentsByType.tsx
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

/* ---- Pastel palette ---- */
const CYAN_BASE = '#5AD9E6'
const LAVENDER_BASE = '#CDBDF4'
const PEACH_BASE = '#F7C9C1'
const FALLBACKS = ['#BEE0F5', '#D7F2EE', '#F9E7D0', '#E9D7FB']

/* Fixed colors per known type */
const TYPE_BASES: Record<string, string> = {
  'application/pdf': CYAN_BASE,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    LAVENDER_BASE,
  'text/plain': PEACH_BASE,
}

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

/* Theme hook — يعتمد فقط على كلاس .dark (وأختياري data-theme) */
function useColorMode(): 'light' | 'dark' {
  const get = () => {
    const root = document.documentElement
    const byClass = root.classList.contains('dark')
    const byData = root.getAttribute('data-theme') === 'dark'
    return byClass || byData ? 'dark' : 'light'
  }
  const [m, setM] = useState<'light' | 'dark'>(get)
  useEffect(() => {
    const root = document.documentElement
    const on = () => setM(get())
    const obs = new MutationObserver(on)
    obs.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => obs.disconnect()
  }, [])
  return m
}

type Row = { content_type: string | null }

function normalizeType(ct: string | null): string {
  if (!ct) return 'Unknown'
  const [mime] = ct.split(';') // يشيل ;charset=...
  return mime.trim()
}

export default function DocumentsByType() {
  const [data, setData] = useState<{ type: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mode = useColorMode()

  const theme = useMemo(() => {
    const dark = mode === 'dark'
    return {
      surface: dark ? '#0b0f16' : '#ffffff',     // خلفية التولتيب
      border: dark ? '#1f2937' : '#e5e7eb',      // حد التولتيب
      fg: dark ? '#e5e7eb' : '#111827',          // نص التولتيب/الليجند
      stroke: dark ? '#0b1220' : '#e5e7eb',      // حافة الشرائح
      lighten: dark ? 0.20 : 0.38,               // إضاءة داخلية للتدرّج
      darken: dark ? 0.25 : 0.12,                // تغميق الحافة
      cursor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(148,163,184,0.08)',
      shadow: dark ? '0 10px 24px rgba(0,0,0,.45)' : '0 10px 24px rgba(0,0,0,.18)',
    }
  }, [mode])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from<Row>('documents')
          .select('content_type')
        if (!active) return
        if (error) throw error

        const map = new Map<string, number>()
        ;(data ?? []).forEach((r) => {
          const k = normalizeType(r.content_type)
          map.set(k, (map.get(k) || 0) + 1)
        })
        setData(Array.from(map, ([type, value]) => ({ type, value })))
      } catch (e: any) {
        setError(e?.message || 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="py-12 text-center text-sm" style={{ color: theme.fg }}>Loading…</div>
  if (error)   return <div className="py-12 text-center text-sm text-red-500">{error}</div>
  if (!data.length) return <div className="py-12 text-center text-sm" style={{ color: theme.fg }}>No data.</div>

  const baseFor = (t: string, i: number) =>
    TYPE_BASES[t] ?? FALLBACKS[i % FALLBACKS.length]
  const idFor = (t: string, i: number) =>
    `docsGrad_${i}_${t.replace(/[^a-z0-9]/gi, '_')}`
  const total = data.reduce((s, d) => s + d.value, 0)

  // Tooltip مخصّص — أبيض باللايت، داكن بالدارك
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null
    const p = payload[0]
    const val = Number(p?.value ?? 0)
    const name = String(p?.name ?? '')
    const pct = total ? `${((val / total) * 100).toFixed(1)}%` : '0%'
    return (
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          color: theme.fg,
          borderRadius: 10,
          padding: '8px 10px',
          boxShadow: theme.shadow,
          maxWidth: 280,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{name}</div>
        <div>
          Count: <b>{val}</b> • <span>{pct}</span>
        </div>
      </div>
    )
  }

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
              <Cell key={d.type} fill={`url(#${idFor(d.type, i)})`} />
            ))}
          </Pie>

          <Tooltip
            cursor={{ fill: theme.cursor }}
            wrapperStyle={{ outline: 'none' }}
            content={<CustomTooltip />}
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
