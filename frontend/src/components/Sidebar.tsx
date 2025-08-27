// src/components/Sidebar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  PanelLeft,
  MessageSquare,
  UploadCloud,
  Shield,
  ClipboardList,
  LogOut,
  GaugeCircle,
  Database,
  BarChart2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Sidebar() {
  const [open, setOpen] = useState<boolean>(() => {
    const raw = localStorage.getItem('sidebarOpen')
    return raw ? JSON.parse(raw) : true
  })
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(open))
    document.documentElement.setAttribute('data-sidebar-open', open ? 'true' : 'false')
  }, [open])

  const onLogout = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      localStorage.removeItem('pendingOnboarding')
      navigate('/login', { replace: true })
    }
  }

  /** Floating toggle button; sits outside when the sidebar is open */
  const ToggleBtn = (
    <button
      aria-label={open ? 'Hide sidebar' : 'Show sidebar'}
      onClick={() => setOpen(o => !o)}
      className="fixed top-3 z-50 rounded-full p-2 backdrop-blur-md
                 bg-white/80 text-neutral-800 ring-1 ring-black/10 shadow hover:bg-white
                 dark:bg-neutral-900/80 dark:text-white dark:ring-white/10 dark:hover:bg-neutral-800"
      style={{
        left: open ? 'calc(16rem + 12px)' : '12px',
      }}
    >
      <PanelLeft size={18} />
    </button>
  )

  return (
    <>
      {ToggleBtn}

      <aside
        className={[
          'sidebar',
          'z-40',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Centered brand: EN on the left, AR on the right (locked order) */}
        <div className="sidebar-header justify-center">
          <div dir="ltr" className="flex items-baseline gap-2 select-none">
            <span className="font-latin font-semibold tracking-wide text-indigo-600 dark:text-indigo-400 text-[15px]">
              MUHKAM
            </span>
            <span className="font-ar font-extrabold text-[18px] text-neutral-900 dark:text-white">
              مُحْكَم
            </span>
          </div>
        </div>

        <nav className="sidebar-nav flex-1">
          <NavItem to="/overview" icon={<GaugeCircle size={18} />} label="Overview" />
          <NavItem to="/insights" icon={<BarChart2 size={18} />} label="Dashboard" />
          <NavItem to="/qa" icon={<MessageSquare size={18} />} label="AI Assistant" />
          <NavItem to="/upload" icon={<UploadCloud size={18} />} label="Upload" />
          <NavItem to="/sensitivity" icon={<Shield size={18} />} label="Sensitivity" />
          <NavItem to="/audit" icon={<ClipboardList size={18} />} label="Audit" />
          <NavItem to="/db-audit" icon={<Database size={18} />} label="DB Audit" />
        </nav>

        <div className="p-3 border-t border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition
                       text-neutral-700 hover:bg-black/5
                       dark:text-neutral-300 dark:hover:bg-white/5"
          >
            <LogOut size={18} className="opacity-80" /> Logout
          </button>
        </div>
      </aside>

      {/* Spacer for routes that don't add left padding via .with-sidebar */}
      <div className={`transition-all duration-300 ${open ? 'ml-64' : 'ml-0'}`} />
    </>
  )
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        ['sidebar-link', isActive ? 'active' : ''].join(' ')
      }
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="truncate">{label}</span>
    </NavLink>
  )
}
