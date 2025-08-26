// src/pages/DbAudit.tsx
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../components/ui/ToastProvider'
import { Loader2 } from 'lucide-react'

// ---------- Raw types ----------
interface RawDBFacts {
  engine: string; host: string; port: number; db_name: string; user: string
  transport?: any; credentials?: any; logging?: any; backup_dr?: any; access?: any
}
type Verdict = 'PASS' | 'FAIL' | 'MANUAL' | string
type Priority = 'Low' | 'Medium' | 'High' | string
interface RawDBCheck {
  control_id?: string; id?: string
  section: string
  requirement?: string
  verdict: Verdict
  evidence?: Record<string, any> | string | null
  remediation: string
  priority: Priority
  citations?: string[]
  topic?: string; category?: string
}

// ---------- Normalized UI ----------
interface DBFacts extends RawDBFacts {}
interface DBCheckRow {
  id: string
  section: string
  requirement?: string
  verdict: Verdict
  remediation: string
  priority: Priority
  evidenceText: string
  citations: string[]
  category?: string
}

const REGS_BASE = import.meta.env.VITE_REGS_BASE || ''

function safeId() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'id_' + Math.random().toString(36).slice(2)
}

function formatEvidence(ev: RawDBCheck['evidence']): string {
  if (ev == null) return '—'
  if (typeof ev === 'string') return ev || '—'
  const cleaned: Record<string, any> = {}
  const missing: string[] = []
  for (const [k, v] of Object.entries(ev)) {
    if (v == null || v === '') missing.push(k)
    else cleaned[k] = v
  }
  const parts: string[] = []
  if (Object.keys(cleaned).length) parts.push(JSON.stringify(cleaned, null, 2))
  if (missing.length) parts.push(`⚠ missing: ${missing.join(', ')}`)
  return parts.length ? parts.join('\n\n') : '—'
}

function parseCitation(c: string) {
  const m = c.match(/^(.+?):(\d+):(.+)$/)
  if (!m) return { file: c, page: undefined as number | undefined, source: undefined as string | undefined }
  return { file: m[1], page: Number(m[2]), source: m[3] }
}

function CitationItem({ c }: { c: string }) {
  const { file, page, source } = parseCitation(c)
  const label = (
    <span className="whitespace-nowrap">
      <span className="font-medium">{file.replace(/^STANDARD_|^POLICY_/, '')}</span>
      {page ? <> • page {page}</> : null}
      {source ? <> • {source}</> : null}
    </span>
  )
  if (!REGS_BASE || !file) return <li className="truncate">{label}</li>
  const href = `${REGS_BASE}/${encodeURIComponent(file)}${page ? `#page=${page}` : ''}`
  return (
    <li className="truncate">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400"
      >
        {label}
      </a>
    </li>
  )
}

export default function DbAuditPage() {
  const [dsn, setDsn] = useState(() => localStorage.getItem('db_dsn') || '')
  const [facts, setFacts] = useState<DBFacts | null>(null)
  const [checks, setChecks] = useState<DBCheckRow[] | null>(null)
  const [loadingFacts, setLoadingFacts] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'FAIL' | 'MANUAL' | 'PASS'>('ALL')
  const { toast } = useToast()

  useEffect(() => { localStorage.setItem('db_dsn', dsn) }, [dsn])

  const verdictBadge = (v: Verdict) => {
    const cls = v === 'PASS' ? 'badge-green' : v === 'FAIL' ? 'badge-red' : 'badge-amber'
    return <span className={`badge ${cls}`}>{v}</span>
  }
  const priorityBadge = (p: Priority) => {
    const cls = p === 'High' ? 'badge-red' : p === 'Medium' ? 'badge-amber' : ''
    return <span className={`badge ${cls}`}>{p}</span>
  }

  const normalizeChecks = (rows: RawDBCheck[]): DBCheckRow[] =>
    rows.map((r) => ({
      id: r.control_id || r.id || safeId(),
      section: r.section,
      requirement: r.requirement,
      verdict: r.verdict,
      remediation: r.remediation,
      priority: r.priority,
      evidenceText: formatEvidence(r.evidence),
      citations: Array.isArray(r.citations) ? r.citations : [],
      category: r.topic || r.category
    }))

  const fetchFacts = async () => {
    if (!dsn) return
    setLoadingFacts(true)
    setChecks(null)
    try {
      const { data } = await api.get<RawDBFacts>('/db/facts', { params: { dsn } })
      setFacts(data)
    } catch (e: any) {
      toast({ title: 'Failed to get DB facts', description: e?.message || 'Error retrieving database facts.', variant: 'destructive' })
    } finally {
      setLoadingFacts(false)
    }
  }

  const runAudit = async () => {
    if (!dsn) return
    setLoadingAudit(true)
    setFacts(null)
    try {
      const { data } = await api.get<RawDBCheck[]>('/db/audit', { params: { dsn } })
      setChecks(normalizeChecks(data))
      toast({ title: 'DB audit complete', description: 'Your database report is ready.', variant: 'success' })
    } catch (e: any) {
      toast({ title: 'DB audit failed', description: e?.message || 'Error running database audit.', variant: 'destructive' })
    } finally {
      setLoadingAudit(false)
    }
  }

  const filteredChecks = useMemo(() => {
    if (!checks) return null
    if (verdictFilter === 'ALL') return checks
    return checks.filter(c => c.verdict === verdictFilter)
  }, [checks, verdictFilter])

  const failCount = useMemo(() => (checks?.filter(c => c.verdict === 'FAIL').length ?? 0), [checks])

  const copyDsn = async () => {
    try { await navigator.clipboard.writeText(dsn); toast({ title: 'Copied DSN', variant: 'success' }) } catch {}
  }

  return (
<div className="tab-page tab-stack">
      <div className="card">
        <div className="card-header">
          <h2 className="tab-title">Database audit</h2>
        </div>

        <div className="card-body space-y-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Enter a database DSN to collect facts or run an audit using the NCA checklist.
            DSN example:&nbsp;
            <code className="text-xs break-all text-neutral-600 dark:text-neutral-300">
              mysql+pymysql://user:p%40ss%23word@127.0.0.1:3306/mysql
            </code>
          </p>

          <div className="flex gap-2">
            <input
              value={dsn}
              onChange={(e) => setDsn(e.target.value)}
              className="input flex-1"
              placeholder="Database DSN"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="btn-outline" onClick={copyDsn} title="Copy DSN">Copy</button>
          </div>

          {/* Actions — نفس ستايل أزرار الرفع (outlined + spinner) */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={fetchFacts}
              disabled={loadingFacts || !dsn}
              className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-medium
                         border border-indigo-500 text-indigo-600 bg-transparent hover:bg-indigo-50
                         dark:text-indigo-300 dark:border-indigo-400/60 dark:hover:bg-white/5
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingFacts && <Loader2 className="animate-spin" size={16} />}
              {loadingFacts ? 'Fetching…' : 'Get facts'}
            </button>

            <button
              type="button"
              onClick={runAudit}
              disabled={loadingAudit || !dsn}
              className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-medium
                         border border-indigo-500 text-indigo-600 bg-transparent hover:bg-indigo-50
                         dark:text-indigo-300 dark:border-indigo-400/60 dark:hover:bg-white/5
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingAudit && <Loader2 className="animate-spin" size={16} />}
              {loadingAudit ? 'Auditing…' : 'Run audit'}
            </button>

            {checks && (
              <>
                <span className="ml-auto text-sm text-neutral-700 dark:text-neutral-300">
                  Findings: <strong>{checks.length}</strong> • Fails: <strong className="text-red-600 dark:text-red-400">{failCount}</strong>
                </span>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-neutral-700 dark:text-neutral-300">Filter:</span>
                  <select
                    className="input py-1 px-2"
                    value={verdictFilter}
                    onChange={(e) => setVerdictFilter(e.target.value as any)}
                  >
                    <option value="ALL">All</option>
                    <option value="FAIL">Fail</option>
                    <option value="MANUAL">Manual</option>
                    <option value="PASS">Pass</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {facts && (
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-neutral-900 dark:text-neutral-100">Database facts</h3>
              <table className="table">
                <tbody>
                  <tr><td className="font-medium">Engine</td><td>{facts.engine}</td></tr>
                  <tr><td className="font-medium">Host</td><td>{facts.host}:{facts.port}</td></tr>
                  <tr><td className="font-medium">Database</td><td>{facts.db_name}</td></tr>
                  <tr><td className="font-medium">User</td><td>{facts.user}</td></tr>
                </tbody>
              </table>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-neutral-700 dark:text-neutral-300">Show raw sections</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800
                                 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
{JSON.stringify(
  {
    transport: facts.transport ?? null,
    credentials: facts.credentials ?? null,
    logging: facts.logging ?? null,
    backup_dr: facts.backup_dr ?? null,
    access: facts.access ?? null
  },
  null, 2)}
                </pre>
              </details>
            </div>
          )}

          {filteredChecks && (
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-neutral-900 dark:text-neutral-100">Audit results</h3>

              <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white
                              dark:border-neutral-800 dark:bg-neutral-900">
                <table className="table">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-neutral-900">
                    <tr className="text-left">
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Section</th>
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Requirement</th>
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Verdict</th>
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Remediation</th>
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Priority</th>
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">Evidence</th>
                      <th className="px-3 py-2 text-neutral-700 dark:text-neutral-300">References</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredChecks.map((c) => (
                      <tr key={c.id} className="align-top">
                        <td className="px-3 py-2 font-medium text-neutral-800 dark:text-neutral-200">
                          {c.section}
                          {c.category && <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{c.category}</div>}
                        </td>
                        <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{c.requirement ?? '—'}</td>
                        <td className="px-3 py-2">{verdictBadge(c.verdict)}</td>
                        <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{c.remediation}</td>
                        <td className="px-3 py-2">{priorityBadge(c.priority)}</td>
                        <td className="px-3 py-2 text-xs">
                          <pre className="max-h-36 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-neutral-800 whitespace-pre-wrap
                                           dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
{c.evidenceText}
                          </pre>
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200">
                          {c.citations.length > 0 ? (
                            <ul className="space-y-1">
                              {c.citations.map((ref, idx) => <CitationItem key={idx} c={ref} />)}
                            </ul>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
