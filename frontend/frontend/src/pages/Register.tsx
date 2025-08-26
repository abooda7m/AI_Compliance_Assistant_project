import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import TopControls from '../components/TopControls'
import Brand from '../components/Brand'

export default function Register() {
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  const nav = useNavigate()

  const onRegister = async () => {
    setErr(null); setOk(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) { setErr(error.message); return }

    localStorage.setItem('pendingOnboarding', JSON.stringify({
      full_name: fullName.trim(),
      org_name: orgName.trim()
    }))

    if (data.session) {
      const { error: rpcErr } = await supabase.rpc('create_org_and_join', {
        org_name: orgName.trim(),
        full_name: fullName.trim(),
      })
      if (rpcErr) { setErr(rpcErr.message); return }
      localStorage.removeItem('pendingOnboarding')
      nav('/company')
      return
    }

    setOk(t('register.checkEmail'))
    nav('/login')
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
            {t('register.subtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="mx-auto w-full max-w-[560px]">
          <div className="glass rounded-2xl overflow-hidden">
            {/* Tabs header */}
            <div className="flex items-center gap-2 px-4 md:px-6 tabbar border-b">
              <TabLink to="/register" active={true}>{t('register.title')}</TabLink>
              <TabLink to="/login" active={false}>{t('login.title')}</TabLink>
            </div>

            {/* Body */}
            <div className="p-5 md:p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onRegister() }}>
                <div>
                  <label className="block text-sm mb-1">{t('register.orgName')}</label>
                  <input
                    className="input input-lg"
                    placeholder={t('register.orgName')}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">{t('register.fullName')}</label>
                  <input
                    className="input input-lg"
                    placeholder={t('register.fullName')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">{t('register.email')}</label>
                  <input
                    className="input input-lg"
                    type="email"
                    dir="ltr"
                    placeholder="you@company.sa"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">{t('register.password')}</label>
                  <div className="relative">
                    <input
                      className="input input-lg pr-10"
                      type={showPwd ? 'text' : 'password'}
                      dir="ltr"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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
                {ok && <div className="text-emerald-600 text-sm">{ok}</div>}

                <button type="submit" className="btn-form">
                  {t('register.create')}
                </button>

                <div className="text-center text-sm muted">
                  {t('register.haveAccount')}{' '}
                  <Link to="/login" className="text-brand-indigo hover:underline">
                    {t('register.signInLink')}
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
