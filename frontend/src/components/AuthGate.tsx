import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    let mounted = true

    const finish = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setAuthed(!!session)
      setReady(true)

      // Finish onboarding if pending and user has no profile row
      if (session) {
        try {
          const prof = await supabase.from('profiles').select('org_id').maybeSingle()
          if (!prof.data?.org_id) {
            const raw = localStorage.getItem('pendingOnboarding')
            if (raw) {
              const payload = JSON.parse(raw)
              if (payload?.org_name && payload?.full_name) {
                await supabase.rpc('create_org_and_join', {
                  org_name: String(payload.org_name),
                  full_name: String(payload.full_name),
                })
                localStorage.removeItem('pendingOnboarding')
              }
            }
          }
        } catch {}
      }
    }

    finish()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session)
      setReady(true)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!ready) return <div className="p-6 text-gray-600">Loading…</div>
  if (!authed) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}
