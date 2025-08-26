import React, { createContext, useContext, useState, useCallback } from 'react'

export type Toast = {
  id: number
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
}

type ToastContextValue = {
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Provides a toast notification system. Toasts appear in the bottom-right
 * corner of the page and disappear after 4 seconds unless dismissed.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, ...t }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 space-y-2"
      >
        {toasts.map((t) => {
          const borderColor =
            t.variant === 'destructive'
              ? 'border-red-300'
              : t.variant === 'success'
              ? 'border-green-300'
              : 'border-gray-200'
          return (
            <div
              key={t.id}
              className={`card p-3 min-w-[260px] ${borderColor}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-800">{t.title}</div>
                  {t.description && (
                    <div className="text-sm text-gray-600 mt-0.5">
                      {t.description}
                    </div>
                  )}
                </div>
                <button
                  className="btn-outline px-2 py-1"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}