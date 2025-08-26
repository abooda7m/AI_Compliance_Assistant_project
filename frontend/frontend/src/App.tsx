// src/App.tsx
// App shell with global theme-aware surface.

import { Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ModeToggle from './components/ModeToggle' // keep this

export default function App() {
  return (
    // Theme-aware container (light/dark via .dark on <html>)
    <div className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Persistent sidebar (it sets html[data-sidebar-open]="true|false"]) */}
      <Sidebar />

      {/* Global mode toggle (fixed top-right) */}
      <ModeToggle />

      {/* Main content: left padding handled by .with-sidebar + html[data-sidebar-open] */}
      <main className="with-sidebar max-w-6xl mx-auto px-4 py-6" role="main">
        <Outlet />
      </main>
    </div>
  )
}
