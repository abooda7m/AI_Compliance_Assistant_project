import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Company = { id: string; name: string; industry?: string | null; domain?: string | null; created_at: string }

export default function CompanyPage() {
  const [items, setItems] = useState<Company[]>([])
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [domain, setDomain] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    try {
      const { data } = await api.get<Company[]>('/companies')
      setItems(data)
    } catch (e: any) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    try {
      await api.post('/companies', { name, industry: industry || null, domain: domain || null })
      setName(''); setIndustry(''); setDomain('')
      await load()
    } catch (e: any) { setErr(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header"><h2 className="text-lg font-semibold">Companies</h2></div>
        <div className="card-body space-y-3">
          <div className="grid md:grid-cols-3 gap-2">
            <input className="input" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
            <input className="input" placeholder="Industry" value={industry} onChange={e=>setIndustry(e.target.value)} />
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Domain" value={domain} onChange={e=>setDomain(e.target.value)} />
              <button className="btn" onClick={create} disabled={!name.trim()}>Add</button>
            </div>
          </div>
          {err && <div className="text-red-400 text-sm">{err}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-medium">Your companies</h3></div>
        <div className="card-body">
          <ul className="space-y-2">
            {items.map((c)=>(
              <li key={c.id} className="border border-gray-200 rounded p-2">
                <div className="font-medium text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-500">{c.industry || '—'} · {c.domain || '—'}</div>
              </li>
            ))}
            {items.length === 0 && <div className="text-sm text-gray-500">No companies yet.</div>}
          </ul>
        </div>
      </div>
    </div>
  )
}
