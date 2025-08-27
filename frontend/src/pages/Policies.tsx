import { useState } from 'react'
import { api } from '../lib/api'

type CompanyFacts = {
  company_name: string
  activities: string[]
  purposes: string[]
  data_categories: string[]
  data_subjects?: string[]
  processors?: string[]
  recipients?: string[]
  cross_border?: string
  retention_overview?: string
  security_measures?: string[]
  breach_sla_hours?: number
  minors_involved?: boolean
  special_categories?: boolean
  contacts?: Record<string, string>
}

function slugify(s: string) {
  return (s || 'policy').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'policy'
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const defaultFacts: CompanyFacts = {
  company_name: 'Acme Corp',
  activities: ['ecommerce'],
  purposes: ['order processing'],
  data_categories: ['contact', 'payment'],
}

export default function PoliciesPage() {
  const [facts, setFacts] = useState<CompanyFacts>(defaultFacts)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<any | null>(null)
  const [compose, setCompose] = useState<any | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function setField<K extends keyof CompanyFacts>(k: K, v: CompanyFacts[K]) {
    setFacts(prev => ({ ...prev, [k]: v }))
  }

  const runPlan = async () => {
    setLoading(true); setErr(null); setCompose(null)
    try {
      const { data } = await api.post('/regs/policies/plan', { facts })
      setPlan(data)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  const runCompose = async () => {
    setLoading(true); setErr(null); setPlan(null)
    try {
      const body = { facts, language: 'en', format: 'markdown', max_policies: 7, strict_retrieval: true }
      const { data } = await api.post('/regs/policies/plan-compose', body)
      setCompose(data)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header"><h2 className="text-lg font-semibold">Policy planner & composer</h2></div>
        <div className="card-body space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Company name</label>
              <input className="input" value={facts.company_name} onChange={(e)=>setField('company_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Activities (comma separated)</label>
              <input className="input" value={facts.activities.join(', ')} onChange={(e)=>setField('activities', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Purposes</label>
              <input className="input" value={(facts.purposes||[]).join(', ')} onChange={(e)=>setField('purposes', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Data categories</label>
              <input className="input" value={(facts.data_categories||[]).join(', ')} onChange={(e)=>setField('data_categories', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn" onClick={runPlan} disabled={loading}>Generate plan</button>
            <button className="btn" onClick={runCompose} disabled={loading}>Plan & compose</button>
          </div>

          {loading && <div className="skeleton h-24 w-full" />}
          {err && <div className="text-red-400">{err}</div>}

          {plan && (
            <div className="space-y-2">
              <h3 className="font-medium">Plan</h3>
              <ul className="list-disc pl-5 text-sm">
                {plan?.plan?.items?.map((it: any, i: number) => (
                  <li key={i}><strong>{it.policy_id}</strong>{it.title ? ` — ${it.title}` : ''}{it.rationale ? `: ${it.rationale}` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {compose && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Composed Policies</h3>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    const files = (compose?.policies || [])
                      .map((p: any) => `# ${p.title || p.policy_id}\n\n${p.content || p.body || ''}`)
                      .join('\n\n---\n\n')
                    downloadText(`${slugify(facts.company_name || 'company')}-policies.md`, files)
                  }}
                >
                  Download all (.md)
                </button>
              </div>

              {(compose?.policies || []).map((p: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{p.title || p.policy_id}</h4>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() =>
                        downloadText(`${slugify(p.title || p.policy_id)}.md`, `# ${p.title || p.policy_id}\n\n${p.content || p.body || ''}`)
                      }
                    >
                      Download .md
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{p.content || p.body || 'No policy content.'}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
