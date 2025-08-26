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
  BarChart2,     // <-- for Insights tab
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
    try { await supabase.auth.signOut() } finally {
      localStorage.removeItem('pendingOnboarding')
      navigate('/login', { replace: true })
    }
  }

  const ToggleBtn = (
    <button
      aria-label={open ? 'Hide sidebar' : 'Show sidebar'}
      onClick={() => setOpen(o => !o)}
      className="fixed top-3 left-3 z-50 rounded-full p-2 backdrop-blur-md
                 bg-white/80 text-neutral-800 ring-1 ring-black/10 shadow hover:bg-white
                 dark:bg-neutral-900/80 dark:text-white dark:ring-white/10 dark:hover:bg-neutral-800"
    >
      <PanelLeft size={18} />
    </button>
  )

  return (
    <>
      {ToggleBtn}

      {/* استخدم الـ .sidebar الموحدة بدل لون أزرق ثابت */}
      <aside
        className={[
          'sidebar', // يضبط: bg-white / dark:bg-neutral-950 + الحدود
          'z-40',     // تأكيد الارتفاع
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="sidebar-header">
          <img src="/muhkam-favicon.svg" alt="Muhkam" className="h-6 w-6 rounded-sm" />
          <div className="leading-none">
            <span className="font-bold tracking-wide text-[15px] text-neutral-900 dark:text-neutral-100">
              مُحْكَم
            </span>
            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">Compliance</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav flex-1">
          <NavItem to="/overview" icon={<GaugeCircle size={18} />} label="Overview" />
          <NavItem to="/qa" icon={<MessageSquare size={18} />} label="QA" />
          <NavItem to="/upload" icon={<UploadCloud size={18} />} label="Upload" />
          <NavItem to="/sensitivity" icon={<Shield size={18} />} label="Sensitivity" />
          <NavItem to="/audit" icon={<ClipboardList size={18} />} label="Audit" />
          <NavItem to="/db-audit" icon={<Database size={18} />} label="DB Audit" />
          <NavItem to="/insights" icon={<BarChart2 size={18} />} label="Dashboard" />

        </nav>


        {/* Footer / Logout */}
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

      {/* Spacer للي ما يستخدم .with-sidebar */}
      <div className={`transition-all duration-300 ${open ? 'ml-64' : 'ml-0'}`} />
    </>
  )
}

function NavItem({
  to, icon, label,
}: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'sidebar-link',           // ستايل موحّد
          isActive ? 'active' : '', // يغيّر الخلفية/اللون وفق الثيم
        ].join(' ')
      }
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="truncate">{label}</span>
    </NavLink>
  )
}