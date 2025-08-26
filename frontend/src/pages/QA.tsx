// src/pages/QA.tsx
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { Send, Copy, Loader2, Bot, User } from 'lucide-react'

type QAResponse = { answer: string; citations?: any[] }

type ChatMsg = {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  citations?: any[]
}

export default function QAPage() {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])

  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  /** Render assistant text into tidy paragraphs/lists */
  function renderAnswer(text: string) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const nodes: JSX.Element[] = []
    const isBullet = (s: string) => /^\s*([-*•])\s+/.test(s)
    const isNumbered = (s: string) => /^\s*\d+\.\s+/.test(s)
    let i = 0

    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue }

      if (isBullet(lines[i])) {
        const items: string[] = []
        while (i < lines.length && isBullet(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•])\s+/, ''))
          i++
        }
        nodes.push(
          <ul key={`ul-${i}-${nodes.length}`} className="list-disc pl-5 space-y-1 text-sm leading-7">
            {items.map((it, idx) => <li key={idx}>{it}</li>)}
          </ul>
        )
        continue
      }

      if (isNumbered(lines[i])) {
        const items: string[] = []
        while (i < lines.length && isNumbered(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
          i++
        }
        nodes.push(
          <ol key={`ol-${i}-${nodes.length}`} className="list-decimal pl-5 space-y-1 text-sm leading-7">
            {items.map((it, idx) => <li key={idx}>{it}</li>)}
          </ol>
        )
        continue
      }

      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isNumbered(lines[i])) {
        para.push(lines[i]); i++
      }
      nodes.push(
        <p key={`p-${i}-${nodes.length}`} className="text-sm leading-7">
          {para.join(' ').replace(/\s{2,}/g, ' ').trim()}
        </p>
      )
    }
    return <div className="space-y-3">{nodes}</div>
  }

  /** Ask flow */
  const ask = async (textOverride?: string) => {
    if (loading) return
    const text = (textOverride ?? q).trim()
    if (!text) return

    const userMsg: ChatMsg = { id: uid(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setQ('')

    setLoading(true)
    try {
      const { data } = await api.post<QAResponse>('/qa', { question: text })
      const aiMsg: ChatMsg = {
        id: uid(),
        role: 'assistant',
        content: data?.answer ?? '',
        citations: Array.isArray(data?.citations) ? data.citations : [],
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (e: any) {
      const errMsg: ChatMsg = {
        id: uid(),
        role: 'error',
        content: e?.message || 'Request failed',
      }
      setMessages(prev => [...prev, errMsg])
    } finally { setLoading(false) }
  }

  /** Keyboard UX */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    const forceSend = e.ctrlKey || e.metaKey
    const newLine = e.shiftKey
    if (forceSend || (!newLine && !loading)) {
      e.preventDefault()
      void ask()
    }
  }

  /** Auto-grow textarea height */
  const onAutoGrow = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    ta.style.height = 'auto'
    ta.style.height = Math.min(220, ta.scrollHeight) + 'px'
  }

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
  }

  return (
    <div className="container-max py-6 tab-page" >
      <section className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900/70 shadow-sm min-h-[78vh] flex flex-col">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h3 className="tab-title">AI Compliance Assistant</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Expert guidance on PDPL and NCA regulations
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4 md:py-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === 'user'
            const isAI = m.role === 'assistant'
            const isErr = m.role === 'error'

            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'} group`}
              >
                {/* Avatar */}
                {!isUser && (
                  <div className="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                    {isAI ? <Bot size={16} /> : <span className="text-xs font-semibold">!</span>}
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={[
                    'relative max-w-[min(78ch,80%)] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm',
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : isErr
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800/40'
                        : 'bg-black/5 text-neutral-900 dark:bg-white/10 dark:text-neutral-100',
                  ].join(' ')}
                >
                  {/* Copy on AI */}
                  {isAI && (
                    <button
                      onClick={() => copyText(m.content)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/10"
                      aria-label="Copy answer"
                      title="Copy answer"
                    >
                      <Copy size={14} />
                    </button>
                  )}

                  {isAI
                    ? renderAnswer(m.content)
                    : <pre className="whitespace-pre-wrap">{m.content}</pre>
                  }

                  {/* Citations */}
                  {isAI && Array.isArray(m.citations) && m.citations.length > 0 && (
                    <details className="mt-3 text-xs/relaxed opacity-90">
                      <summary className="cursor-pointer select-none">Citations</summary>
                      <ul className="list-disc pl-5 space-y-1 mt-1">
                        {m.citations.map((c, i) => (
                          <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>

                {/* User avatar (on the right) */}
                {isUser && (
                  <div className="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <User size={16} />
                  </div>
                )}
              </div>
            )
          })}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                <Bot size={16} />
              </div>
              <div className="bg-black/5 dark:bg-white/10 rounded-2xl px-4 py-3 text-[14px] leading-relaxed">
                <div className="inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Thinking…
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="border-t border-black/10 dark:border-white/10 bg-neutral-50/60 dark:bg-neutral-950/40 px-3 md:px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea
              className="input flex-1 resize-none h-[44px] min-h-[44px] max-h-[200px] py-2.5 leading-5"
              style={{ height: '44px' }}          /* keeps initial height perfect */
              placeholder="Ask about SDAIA, PDPL regulations..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={onAutoGrow}
              rows={1}
            />

            <button
              className="btn h-11 shrink-0"
              onClick={() => ask()}
              disabled={!q.trim() || loading}
              aria-label="Send"
              title="Send"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
