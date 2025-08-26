import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import TopControls from '../components/TopControls'
import Brand from '../components/Brand'

export default function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const nav = useNavigate()
  const loc = useLocation() as any

  const onLogin = async () => {
    setLoading(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setErr(error.message); return }
    nav(loc.state?.from || '/overview', { replace: true })
  }

  const TabLink = ({
    to, active, children,
  }: { to: string; active: boolean; children: React.ReactNode }) => (
    <Link
      to={to}
      className={[
        'flex-1 text-center py-3 text-sm md:text-base rounded-t-xl transition border-b-2',
        active
          ? 'text-neutral-900 dark:text-white border-indigo-500'
          : 'muted border-transparent hover:text-neutral-700 dark:hover:text-neutral-200',
      ].join(' ')}
    >
      {children}
    </Link>
  )

  return (
    <div className="min-h-dvh app-surface relative overflow-x-hidden">
      <TopControls />

      <main className="container-max pt-16 md:pt-20 pb-10">
        {/* Heading */}
        <div className="text-center mb-6 md:mb-8">
          {/* أصغر شوي */}
          <h1 className="leading-none"><Brand size="sm" /></h1>
          <p className="mt-2 text-sm md:text-base muted">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="mx-auto w-full max-w-[560px]">
          <div className="glass rounded-2xl overflow-hidden">
            {/* Tabs header */}
            <div className="flex items-center gap-2 px-4 md:px-6 tabbar border-b">
              <TabLink to="/register" active={false}>{t('register.title')}</TabLink>
              <TabLink to="/login" active={true}>{t('login.title')}</TabLink>
            </div>

            {/* Body */}
            <div className="p-5 md:p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onLogin() }}>
                <div>
                  <label className="block text-sm mb-1">{t('login.email')}</label>
                  <input
                    className="input input-lg"
                    type="email"
                    dir="ltr"
                    autoComplete="username"
                    placeholder="you@company.sa"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">{t('login.password')}</label>
                  <div className="relative">
                    <input
                      className="input input-lg pr-10"
                      type={showPwd ? 'text' : 'password'}
                      dir="ltr"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 dark:text-neutral-400"
                      onClick={() => setShowPwd((s) => !s)}
                      aria-label={showPwd ? t('aria.hidePassword') : t('aria.showPassword')}
                      title={showPwd ? t('aria.hidePassword') : t('aria.showPassword')}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {err && <div className="text-red-500 text-sm">{err}</div>}

                <button type="submit" className="btn-form" disabled={loading}>
                  {loading ? t('login.signingIn') : t('login.signIn')}
                </button>

                <div className="text-center text-sm muted">
                  {t('login.noAccount')}{' '}
                  <Link to="/register" className="text-brand-indigo hover:underline">
                    {t('login.registerLink')}
                  </Link>
                </div>
              </form>
            </div>
          </div>

          {/* Back to home */}
          <div className="text-center mt-4">
            <Link
              to="/"
              className="text-sm muted hover:text-neutral-700 dark:hover:text-neutral-200"
            > 
              {t('auth.backHome')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
