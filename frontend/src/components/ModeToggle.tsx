// src/components/ModeToggle.tsx
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
const STORAGE_KEY = 'theme'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  localStorage.setItem(STORAGE_KEY, theme)
}

export default function ModeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <div
      className="
        fixed top-3 right-3 z-50
        flex items-center gap-1 p-1 rounded-full
        bg-white/70 text-neutral-800
        border border-black/10 shadow
        backdrop-blur
        dark:bg-neutral-900/70 dark:text-neutral-100 dark:border-white/10
      "
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={[
          'px-3 py-1.5 rounded-full text-sm transition',
          theme === 'dark'
            ? 'bg-indigo-600 text-white shadow'
            : 'hover:bg-black/5 dark:hover:bg-white/10'
        ].join(' ')}
      >
        Dark
      </button>
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={[
          'px-3 py-1.5 rounded-full text-sm transition',
          theme === 'light'
            ? 'bg-indigo-600 text-white shadow'
            : 'hover:bg-black/5 dark:hover:bg-white/10'
        ].join(' ')}
      >
        Light
      </button>
    </div>
  )
}
