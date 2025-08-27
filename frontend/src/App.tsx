// src/App.tsx
import { Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ModeToggle from './components/ModeToggle'

export default function App() {
  return (
    <div className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar />
      <ModeToggle />
      {/* the left padding is driven only by .with-sidebar (no extra spacer) */}
      <main className="with-sidebar container-max py-6">
        <Outlet />
      </main>
    </div>
  )
}
