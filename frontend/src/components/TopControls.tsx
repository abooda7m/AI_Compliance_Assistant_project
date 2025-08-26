import { useTheme, useLang } from '../lib/hooks'

type Props = {
  showLang?: boolean
  showTheme?: boolean
}
export default function TopControls({ showLang = true, showTheme = true }: Props) {
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useLang()

  const group =
    'flex items-center gap-0.5 rounded-full p-0.5 backdrop-blur-md ' +
    'border border-black/10 bg-black/5 text-neutral-800 ' +
    'dark:border-white/15 dark:bg-white/10 dark:text-white shadow-card whitespace-nowrap'

  const btn =
    'px-0 py-1.5 w-[72px] text-center text-xs md:text-sm rounded-full transition-colors ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sdaia-indigo/50'

  const active = 'shadow'
  const activeFilled = 'bg-sdaia-indigo text-white ' + active
  const activeLight = 'bg-white text-neutral-900 ' + active
  const idle = 'hover:bg-black/10 dark:hover:bg-white/10'

  return (
    <div dir="ltr" className="fixed top-3 right-3 md:top-5 md:right-5 z-40 flex items-center gap-2">
      {showLang && (
        <div className={group} role="group" aria-label="Language">
          <button
            onClick={() => setLang('ar')}
            className={`${btn} ${lang === 'ar' ? activeFilled : idle}`}
            aria-pressed={lang === 'ar'}
          >
            عربي
          </button>
          <button
            onClick={() => setLang('en')}
            className={`${btn} ${lang === 'en' ? activeFilled : idle}`}
            aria-pressed={lang === 'en'}
          >
            EN
          </button>
        </div>
      )}

      {showTheme && (
        <div className={group} role="group" aria-label="Theme">
          <button
            onClick={() => setTheme('dark')}
            className={`${btn} ${theme === 'dark' ? activeFilled : idle}`}
            aria-pressed={theme === 'dark'}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`${btn} ${theme === 'light' ? activeLight : idle}`}
            aria-pressed={theme === 'light'}
          >
            Light
          </button>
        </div>
      )}
    </div>
  )
}
