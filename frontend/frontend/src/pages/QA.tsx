// src/pages/QA.tsx
// Chat UI (single panel) with pretty-formatted assistant replies
// and a non-intrusive Copy button. UI-only: the /qa API contract is unchanged.

import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { Send, Copy, Loader2 } from 'lucide-react'

type QAResponse = { answer: string; citations?: any[] }

type ChatMsg = {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  citations?: any[]
}

export default function QAPage() {
  // --- Input & state ---
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])

  // --- Auto-scroll to newest message ---
  const endRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  // --- Simple id generator for UI keys ---
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // --- Pretty renderer for assistant answers (bullets & paragraphs) ---
  function renderAnswer(text: string) {
    // Normalize line endings
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const nodes: JSX.Element[] = []
    let i = 0

    const isBullet = (s: string) => /^\s*([-*•])\s+/.test(s)
    const isNumbered = (s: string) => /^\s*\d+\.\s+/.test(s)

    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue }

      // Unordered list
      if (isBullet(lines[i])) {
        const items: string[] = []
        while (i < lines.length && isBullet(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*•])\s+/, ''))
          i++
        }
        nodes.push(
          <ul key={`ul-${i}-${nodes.length}`} className="md-ul">
            {items.map((it, idx) => <li key={idx}>{it}</li>)}
          </ul>
        )
        continue
      }

      // Ordered list
      if (isNumbered(lines[i])) {
        const items: string[] = []
        while (i < lines.length && isNumbered(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
          i++
        }
        nodes.push(
          <ol key={`ol-${i}-${nodes.length}`} className="md-ol">
            {items.map((it, idx) => <li key={idx}>{it}</li>)}
          </ol>
        )
        continue
      }

      // Paragraph until next blank/list
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !isBullet(lines[i]) && !isNumbered(lines[i])) {
        para.push(lines[i]); i++
      }
      nodes.push(
        <p key={`p-${i}-${nodes.length}`} className="md-p">
          {para.join(' ').replace(/\s{2,}/g, ' ').trim()}
        </p>
      )
    }
    return <div className="md-wrap">{nodes}</div>
  }

  // --- Ask flow: push user bubble -> call API -> push assistant bubble ---
  const ask = async (textOverride?: string) => {
    if (loading) return
    const text = (textOverride ?? q).trim()
    if (!text) return

    const userMsg: ChatMsg = { id: uid(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setQ('')

    setLoading(true)
    try {
      // NOTE: Backend contract unchanged
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

  // --- Keyboard UX: Enter to send, Shift+Enter newline, Ctrl/Cmd+Enter sends ---
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    const forceSend = e.ctrlKey || e.metaKey
    const newLine = e.shiftKey
    if (forceSend || (!newLine && !loading)) {
      e.preventDefault()
      void ask()
    }
  }

  // --- Auto-grow textarea height (soft cap) ---
  const onAutoGrow = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    ta.style.height = 'auto'
    ta.style.height = Math.min(220, ta.scrollHeight) + 'px'
  }

  // --- Copy assistant content ---
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* no-op */ }
  }

  return (
    <div className="container-max py-4">
      {/* Taller card + extra bottom padding so the input sits higher */}
      <section className="card flex flex-col min-h-[82vh] pb-6">
        <div className="card-header">
          <h3 className="text-lg font-semibold">AI Compliance Assistant</h3>
          <p className="text-sm text-gray-400">Expert guidance on PDPL and NCA regulations</p>
        </div>

        {/* Messages */}
        <div className="chat-scroll">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`msg ${
                m.role === 'user' ? 'msg-user' : m.role === 'assistant' ? 'msg-ai' : 'msg-error'
              } group`}
            >
              {/* Copy button: small, outside the bubble, only on hover */}
              {m.role === 'assistant' && (
                <button
                  className="msg-actions btn-icon"
                  onClick={() => copyText(m.content)}
                  aria-label="Copy answer"
                  title="Copy answer"
                >
                  <Copy size={14} />
                </button>
              )}

              {/* Pretty rendering for assistant; raw for user/error */}
              {m.role === 'assistant'
                ? renderAnswer(m.content)
                : <pre className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</pre>
              }

              {/* Collapsible citations */}
              {m.role === 'assistant' && Array.isArray(m.citations) && m.citations.length > 0 && (
                <details className="mt-2 text-xs opacity-90">
                  <summary className="cursor-pointer select-none">Citations</summary>
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                    {m.citations.map((c, i) => (
                      <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}

          {loading && (
            <div className="msg msg-ai">
              <div className="inline-flex items-center gap-2 text-[13px]">
                <Loader2 className="animate-spin" size={16} />
                Thinking…
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input bar — push it up a bit */}
        <div className="input-bar px-4 py-3 mt-auto mb-4">
          <div className="flex items-end gap-2">
            <textarea
              className="input flex-1 resize-none"
              placeholder="Ask about SDAIA, PDPL regulations..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={onAutoGrow}
              rows={2}
            />
            <button
              className="btn"
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
