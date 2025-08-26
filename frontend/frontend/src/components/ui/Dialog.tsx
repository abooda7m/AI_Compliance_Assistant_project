import React from 'react'

interface DialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title?: string
  children?: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Light-themed modal dialog component. When `open` is false the dialog
 * does not render anything. The overlay darkens the rest of the page and
 * clicking it will close the dialog. The card container reuses the base
 * card styles for consistency with other panels and uses a light
 * background with subtle borders.
 */
export function Dialog({ open, onOpenChange, title, children, footer }: DialogProps) {
  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="card w-full max-w-2xl overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <button
              className="btn-outline px-2 py-1"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="card-body">{children}</div>
          {footer && (
            <div className="p-4 border-t border-gray-200">{footer}</div>
          )}
        </div>
      </div>
    </div>
  )
}