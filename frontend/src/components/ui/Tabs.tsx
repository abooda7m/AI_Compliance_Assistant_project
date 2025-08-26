import React, { useState } from 'react'
export function Tabs({
  tabs,
  value,
  onValueChange,
}: {
  tabs: { value: string; label: string }[]
  value?: string
  onValueChange?: (v: string) => void
}) {
  const [internal, setInternal] = useState(tabs[0]?.value)
  const current = value ?? internal
  const set = (v: string) => (onValueChange ? onValueChange(v) : setInternal(v))

  return (
    <div>
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${
              current === t.value
                ? 'border-blue-600 text-blue-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => set(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
export function TabPanel({ when, value, children }:{ when:string; value:string; children:React.ReactNode }){ if(when !== value) return null; return <div className="pt-4">{children}</div> }