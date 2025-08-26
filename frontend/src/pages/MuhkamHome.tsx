// src/pages/MuhkamHome.tsx
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import TopControls from '../components/TopControls'
import { useI18n } from '../lib/i18n'

export default function MuhkamHome() {
  const { t } = useI18n()
  const [canReveal, setCanReveal] = useState(false)
  const [showFeaturesHead, setShowFeaturesHead] = useState(false)
  const featuresRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const mark = () => setCanReveal(true)
    const onScroll = () => { if (window.scrollY > 1) setCanReveal(true) }
    window.addEventListener('pointerdown', mark, { passive: true })
    window.addEventListener('wheel', mark, { passive: true })
    window.addEventListener('keydown', mark)
    window.addEventListener('scroll', onScroll, { passive: true })

    const syncHash = () => {
      if (window.location.hash === '#features') {
        setCanReveal(true)
        setShowFeaturesHead(true)
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)

    const el = featuresRef.current
    const io =
      el &&
      new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && canReveal) setShowFeaturesHead(true)
          })
        },
        { threshold: 0.3, rootMargin: '0px 0px -20% 0px' }
      )
    if (el && io) io.observe(el)

    return () => {
      window.removeEventListener('pointerdown', mark)
      window.removeEventListener('wheel', mark)
      window.removeEventListener('keydown', mark)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', syncHash)
      if (el && io) io.disconnect()
    }
  }, [canReveal])

  return (
    <div className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-white relative overflow-hidden">
      <TopControls />

      <div className="absolute inset-0 pointer-events-none dark:bg-[radial-gradient(ellipse_at_center,rgba(67,56,202,0.08),transparent_55%)]" />

      <div className="relative">
        {/* HERO */}
        <header className="container-max min-h-[100svh] pt-24 md:pt-32 pb-24 text-center animate-fade-up">
          <h1 className="mt-6 font-ar font-extrabold leading-[1.1] tracking-tight">
            <span className="block text-5xl md:text-7xl lg:text-8xl">مُحْكَم</span>
            <span className="block mt-1 text-2xl md:text-3xl lg:text-4xl text-brand-indigo">MUHKAM</span>
          </h1>

          <p className="mt-6 md:mt-7 text-base md:text-xl lg:text-2xl text-neutral-700 dark:text-white/90">
            {t('home.hero.tagline')}
          </p>

          <div className="mt-8 md:mt-10 flex items-center justify-center gap-3">
            <Link
              to="/get-started"
              className="btn-primary btn-hero hover:shadow-[0_0_40px_rgba(67,56,202,.55)]"
            >
              {t('cta.getStarted')}
            </Link>

            <a
              href="#features"
              onClick={() => { setCanReveal(true); setShowFeaturesHead(true) }}
              className="btn-secondary btn-hero transition
                         hover:ring-2 hover:ring-indigo-500/50
                         hover:shadow-[0_0_40px_rgba(67,56,202,.45)]
                         dark:hover:bg-white/15 hover:bg-black/10
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
            >
              {t('cta.learnMore')}
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center">
            <span className="badge">
              {t('badge.builtWithLove')} <span className="text-lg leading-none">❤️</span>
            </span>
          </div>
        </header>

        {/* FEATURES */}
        <section id="features" ref={featuresRef} className="section section-anchor pt-0">
          <div
            className={[
              'mx-auto h-[3px] w-8/12 md:w-1/2 lg:w-[560px] rounded-full',
              'bg-brand-indigo shadow-[0_0_14px_rgba(67,56,202,0.35)] mb-8',
              'transition-all duration-500 origin-center',
              showFeaturesHead ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50',
            ].join(' ')}
          />

          <div
            className={[
              'text-center mb-6 md:mb-8 transition-all duration-500',
              showFeaturesHead ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
            ].join(' ')}
          >
            <h2 className="section-title">{t('home.features.title')}</h2>
            <p className="section-subtitle">
              {t('home.features.subtitle')}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { icon: '💼', color: 'text-brand-indigo', title: t('home.card.pdpl.title'), desc: t('home.card.pdpl.desc') },
              { icon: '🔗', color: 'text-sdaia-orange', title: t('home.card.share.title'), desc: t('home.card.share.desc') },
              { icon: '🧭', color: 'text-sdaia-green', title: t('home.card.ai.title'), desc: t('home.card.ai.desc') },
            ].map((c, i) => (
              <div key={i} className="tile tile-lift">
                <div className="flex items-center gap-3">
                  <div className="icon-pill-lg ring-1 ring-black/10 dark:ring-white/10">
                    <span className={`${c.color} text-2xl`}>{c.icon}</span>
                  </div>
                  <h3 className="tile-title">{c.title}</h3>
                </div>
                <p className="tile-sub mt-3">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="section section-anchor">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="section-title">{t('home.how.title')}</h2>
            <p className="section-subtitle">{t('home.how.subtitle')}</p>
          </div>

          <ol className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { k: '1', title: t('home.step.1.title'), desc: t('home.step.1.desc') },
              { k: '2', title: t('home.step.2.title'), desc: t('home.step.2.desc') },
              { k: '3', title: t('home.step.3.title'), desc: t('home.step.3.desc') },
            ].map((s, i) => (
              <li key={i} className="tile tile-lift">
                <div className="text-sm muted">{t(`home.step.${s.k}`)}</div>
                <h3 className="tile-title mt-1">{s.title}</h3>
                <p className="tile-sub mt-2">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FOOTER */}
        <footer className="section pt-0 text-center text-neutral-500 dark:text-white/50 text-xs">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a className="hover:text-neutral-700 dark:hover:text-white/80" href="#features">{t('footer.features')}</a>
            <Link className="hover:text-neutral-700 dark:hover:text-white/80" to="/login">{t('footer.signIn')}</Link>
          </div>
          <div className="mt-4">© {new Date().getFullYear()} MUHKAM</div>
        </footer>
      </div>
    </div>
  )
}
