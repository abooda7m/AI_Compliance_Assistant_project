// src/pages/DbAudit.tsx
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../components/ui/ToastProvider'
import { Loader2, Copy } from 'lucide-react'

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
type AuditAPIResponse =
  | RawDBCheck[]
  | { checks: RawDBCheck[]; summary?: string }

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

function formatEvidence(ev: RawDBCheck['evidence'] | undefined): string {
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
  if (!m) return { file: c, page: undefined, source: undefined }
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
  const [auditSummary, setAuditSummary] = useState<string | null>(null)
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
    setAuditSummary(null)
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
    setAuditSummary(null)
    try {
      const { data } = await api.get<AuditAPIResponse>('/db/audit', { params: { dsn } })
      const rawChecks: RawDBCheck[] = Array.isArray(data) ? data : (data?.checks ?? [])
      setChecks(normalizeChecks(rawChecks))
      setAuditSummary(Array.isArray(data) ? null : (data?.summary ?? null))
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

            {/* Secondary gray */}
            <button
              type="button"
              onClick={copyDsn}
              title="Copy DSN"
              className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-medium
                         border border-neutral-300 text-neutral-700 bg-transparent hover:bg-black/5
                         dark:text-neutral-200 dark:border-white/20 dark:hover:bg-white/10"
            >
              <Copy size={16} />
              <span>Copy</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Primary button */}
            <button
              type="button"
              onClick={fetchFacts}
              disabled={loadingFacts || !dsn}
              className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-semibold
                         text-white bg-[#94b1b5] hover:bg-[#7fa0a5]
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94b1b5]/60
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingFacts && <Loader2 className="animate-spin" size={16} />}
              {loadingFacts ? 'Fetching…' : 'Get facts'}
            </button>

            {/* Secondary gray */}
            <button
              type="button"
              onClick={runAudit}
              disabled={loadingAudit || !dsn}
              className="inline-flex h-9 min-w-[9.5rem] justify-center items-center gap-2 rounded-lg px-3 text-sm font-medium
                         border border-neutral-300 text-neutral-700 bg-transparent hover:bg-black/5
                         dark:text-neutral-200 dark:border-white/20 dark:hover:bg-white/10
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

          {auditSummary && (
            <div className="mt-2 rounded-lg border border-indigo-200/70 bg-indigo-50/50 p-3 text-sm
                            dark:border-indigo-400/30 dark:bg-indigo-950/20 dark:text-indigo-100">
              <div className="font-medium mb-1 text-indigo-700 dark:text-indigo-200">Summary</div>
              <div className="whitespace-pre-wrap leading-6 text-indigo-800/90 dark:text-indigo-100/95">
                {auditSummary}
              </div>
            </div>
          )}

          {/* Facts & Checks table remain unchanged */}
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
            </div>
          )}

          {filteredChecks && (
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-neutral-900 dark:text-neutral-100">Audit results</h3>
              <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white
                              dark:border-neutral-800 dark:bg-neutral-900">
                <table className="table">{/* ... */}</table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
