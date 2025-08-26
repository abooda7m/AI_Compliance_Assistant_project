// src/lib/i18n.tsx
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

export type Lang = 'en' | 'ar'
type Dict = Record<string, { en: string; ar: string }>

const dict: Dict = {
    // ===== Common / CTA =====
    'cta.getStarted': { en: 'Get Started', ar: 'ابدأ الآن' },
    'cta.learnMore': { en: 'Learn More', ar: 'اعرف المزيد' },
    'badge.builtWithLove': { en: 'Built with love for Saudi Arabia', ar: 'بُني بحبٍّ للمملكة العربية السعودية' },

    // ===== Footer =====
    'footer.features': { en: 'Features', ar: 'المزايا' },
    'footer.howItWorks': { en: 'How it works', ar: 'كيف يعمل' },
    'footer.signIn': { en: 'Sign in', ar: 'تسجيل الدخول' },

    // ===== Home / Hero =====
    'home.hero.tagline': {
        en: 'An intelligent compliance platform for Saudi regulations.',
        ar: 'منصة ذكية للامتثال للوائح والأنظمة السعودية.',
    },

    // ===== Home / Features =====
    'home.features.title': { en: 'Why Muhkam?', ar: 'لماذا مُحْكَم؟' },
    'home.features.subtitle': {
        en: 'Purpose-built for PDPL, Data Sharing Framework, and AI Ethics.',
        ar: 'مصمّم خصيصًا لنظام حماية البيانات الشخصية (PDPL)، وإطار مشاركة البيانات، وأخلاقيات الذكاء الاصطناعي.',
    },

    'home.card.pdpl.title': { en: 'PDPL Readiness', ar: 'الجاهزية لنظام PDPL' },
    'home.card.pdpl.desc': {
        en: 'Clear guidance to assess and address Personal Data Protection Law requirements.',
        ar: 'إرشادات واضحة لتقييم متطلبات نظام حماية البيانات الشخصية ومعالجتها.',
    },

    'home.card.share.title': { en: 'Secure Data Sharing', ar: 'مشاركة البيانات بأمان' },
    'home.card.share.desc': {
        en: 'Align with the Data Sharing Framework for safe and compliant exchanges.',
        ar: 'مواءمة مع إطار مشاركة البيانات لعمليات تبادل آمنة ومتوافقة.',
    },

    'home.card.ai.title': { en: 'AI Ethics by Design', ar: 'أخلاقيات الذكاء الاصطناعي' },
    'home.card.ai.desc': {
        en: 'Practical prompts to embed AI ethics principles from day one.',
        ar: 'موجِّهات عملية لدمج مبادئ أخلاقيات الذكاء الاصطناعي من اليوم الأول.',
    },

    // ===== Home / How it works =====
    'home.how.title': { en: 'How Muhkam Works?', ar: 'كيف يعمل مُحْكَم؟' },
    'home.how.subtitle': { en: 'Three simple steps to move from assessment to action.', ar: 'ثلاث خطوات بسيطة للانتقال من التقييم إلى التنفيذ.' },

    'home.step.1': { en: 'Step 1', ar: 'الخطوة 1' },
    'home.step.1.title': { en: 'Sign in', ar: 'تسجيل الدخول' },
    'home.step.1.desc': { en: 'Create your account and access the tools.', ar: 'أنشئ حسابك وابدأ استخدام الأدوات.' },

    'home.step.2': { en: 'Step 2', ar: 'الخطوة 2' },
    'home.step.2.title': { en: 'Run an assessment', ar: 'إجراء التقييم' },
    'home.step.2.desc': { en: 'Understand your compliance status and gaps.', ar: 'افهم وضع الامتثال لديك والفجوات الموجودة.' },

    'home.step.3': { en: 'Step 3', ar: 'الخطوة 3' },
    'home.step.3.title': { en: 'Implement actions', ar: 'تنفيذ الإجراءات' },
    'home.step.3.desc': { en: 'Follow a guided remediation plan, step by step.', ar: 'اتّبع خطة تصحيح موجّهة خطوة بخطوة.' },

    // ===== RoleSelect =====
    'role.title': { en: 'Choose your role', ar: 'اختر دورك' },
    'role.subtitle': { en: 'Select how you want to use MUHKAM to continue.', ar: 'اختر كيف ستستخدم مُحكَم للمتابعة.' },
    'role.company.title': { en: 'I’m a Company', ar: 'شركة' },
    'role.company.desc': { en: 'Upload files, run sensitivity & audits, and view your company report.', ar: 'ارفَع الملفات، شغِّل اختبارات الحساسية والتدقيق، واستعرض تقرير شركتك.' },
    'role.org.title': { en: 'I’m an Organization (Auditor)', ar: 'منظّمة (جهة مُدقِّقة)' },
    'role.org.desc': { en: 'Review companies, control compliance, and manage companies.', ar: 'راجِع الشركات، تحكّم بالامتثال، وأدِر الشركات.' },

    // ===== Auth / Brand =====
    'auth.brand': { en: 'SDAIA Compliance', ar: 'امتثال سدايا' },

    // ===== Login =====
    'login.title': { en: 'Welcome back', ar: 'مرحبًا بعودتك' },
    'login.subtitle': { en: 'Sign in to your account', ar: 'سجّل الدخول إلى حسابك' },
    'login.email': { en: 'Email', ar: 'البريد الإلكتروني' },
    'login.password': { en: 'Password', ar: 'كلمة المرور' },
    'login.signIn': { en: 'Sign in', ar: 'تسجيل الدخول' },
    'login.signingIn': { en: 'Signing in…', ar: 'جاري تسجيل الدخول…' },
    'login.noAccount': { en: 'No account?', ar: 'ليس لديك حساب؟' },
    'login.registerLink': { en: 'Register', ar: 'إنشاء حساب' },

    // ===== Register =====
    'register.title': { en: 'Create an account', ar: 'إنشاء حساب' },
    'register.subtitle': { en: 'Join your organisation and start analysing documents', ar: 'انضم إلى منظمتك وابدأ تحليل المستندات' },
    'register.fullName': { en: 'Full name', ar: 'الاسم الكامل' },
    'register.orgName': { en: 'Organisation', ar: 'الجهة/المنظمة' },
    'register.email': { en: 'Email', ar: 'البريد الإلكتروني' },
    'register.password': { en: 'Password', ar: 'كلمة المرور' },
    'register.create': { en: 'Create account', ar: 'إنشاء الحساب' },
    'register.haveAccount': { en: 'Already have an account?', ar: 'لديك حساب بالفعل؟' },
    'register.signInLink': { en: 'Sign in', ar: 'تسجيل الدخول' },
    'register.checkEmail': { en: 'Check your email to confirm the account, then sign in.', ar: 'تحقّق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.' },

    'auth.backHome': { en: '← Back to Home', ar: '← الرجوع للصفحة الرئيسية' },


    // ===== A11y =====
    'aria.showPassword': { en: 'Show password', ar: 'إظهار كلمة المرور' },
    'aria.hidePassword': { en: 'Hide password', ar: 'إخفاء كلمة المرور' },
}

type Ctx = { t: (k: string) => string; lang: Lang; setLang: (l: Lang) => void }
const I18nCtx = createContext<Ctx>({ t: (k) => k, lang: 'en', setLang: () => { } })

type I18nProviderProps = {
    children: ReactNode
    initialLang?: Lang
}

export function I18nProvider({ children, initialLang = 'en' }: I18nProviderProps) {
    // قراءة آمنة من localStorage (وت fallback للـ initialLang)
    const [lang, setLang] = useState<Lang>(() => {
        const saved = (typeof window !== 'undefined'
            ? (localStorage.getItem('lang') as Lang | null)
            : null)
        return saved === 'ar' || saved === 'en' ? saved : initialLang
    })

    useEffect(() => {
        // احفظ اللغة وحدث خصائص <html>
        localStorage.setItem('lang', lang)
        const root = document.documentElement
        root.lang = lang
        root.dir = lang === 'ar' ? 'rtl' : 'ltr'
    }, [lang])

    const t = useMemo(() => (k: string) => dict[k]?.[lang] ?? k, [lang])
    const value = useMemo(() => ({ t, lang, setLang }), [t, lang])

    return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
