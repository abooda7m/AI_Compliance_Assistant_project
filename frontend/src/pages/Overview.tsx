// src/pages/Overview.tsx
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Zap,
  BarChart2,
  CheckCircle,
  UploadCloud,
  Shield,
  ClipboardList,
  MessageSquare,
  LayoutDashboard, // ⬅️ NEW
  Database as DatabaseIcon,
} from 'lucide-react'

/** اسم المشروع بنفس شكل MuhkamHome (عربي فوق، إنجليزي تحت) */
function HeroBrand() {
  return (
    <div className="select-none leading-none font-extrabold tracking-tight text-center">
      <div className="font-ar text-black dark:text-white
                      text-[64px] md:text-[84px] lg:text-[96px]">
        مُحْكَم
      </div>
      <div className="font-latin text-brand-indigo
                      text-[28px] md:text-[32px] lg:text-[36px] mt-1 md:mt-2">
        MUHKAM
      </div>
    </div>
  )
}

export default function Overview() {
  return (
    <div className="container-max space-y-16">
      {/* Hero */}
      <section className="text-center pt-16 md:pt-7 pb-28 md:pb-36 lg:pb-2">
        {/* اسم المشروع مثل MuhkamHome */}
        <div className="mt-2 md:mt-4 mb-5">
          <HeroBrand />
        </div>

        <p className="uppercase tracking-wider text-indigo-600 dark:text-indigo-400 text-xs mb-2">
          AI-Powered Compliance Platform
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold">
          Advanced Regulatory Compliance Review
        </h1>
        <p className="max-w-2xl mx-auto mt-4 muted">
          Streamline your compliance auditing process with AI-powered document analysis,
          automated PDPL and NCA standard verification, and intelligent reporting.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link to="/upload" className="btn">Upload Documents</Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <FeatureCard
          icon={<ShieldCheck size={32} className="text-indigo-500 dark:text-indigo-400" />}
          title="Secure Processing"
          description="Enterprise-grade security for sensitive compliance documents"
        />
        <FeatureCard
          icon={<Zap size={32} className="text-emerald-500 dark:text-emerald-400" />}
          title="AI-Powered Analysis"
          description="Advanced OCR and NLP for automated compliance verification"
        />
        <FeatureCard
          icon={<BarChart2 size={32} className="text-purple-500 dark:text-purple-400" />}
          title="Smart Reporting"
          description="Interactive dashboards with real-time compliance metrics"
        />
        <FeatureCard
          icon={<CheckCircle size={32} className="text-teal-500 dark:text-teal-400" />}
          title="Standards Compliance"
          description="Comprehensive PDPL and NCA standards verification"
        />
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-2xl font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          <ActionCard
            to="/upload"
            icon={<UploadCloud size={28} className="opacity-90" />}
            title="Upload Documents"
            description="Securely upload documents for analysis"
          />
          <ActionCard
            to="/sensitivity"
            icon={<Shield size={28} className="opacity-90" />}
            title="Run Sensitivity"
            description="Detect personal data in your files"
          />
          <ActionCard
            to="/audit"
            icon={<ClipboardList size={28} className="opacity-90" />}
            title="Run Audit"
            description="Evaluate compliance and view violations"
          />
          <ActionCard
            to="/qa"
            icon={<MessageSquare size={28} className="opacity-90" />}
            title="AI Assistant"
            description="Get compliance insights and guidance"
          />
          <ActionCard
            to="/db-audit"
            icon={<DatabaseIcon size={28} className="opacity-90" />}
            title="DB Audit"
            description="Check database compliance against NCA rules"
          />
          {/* Dashboard */}
          <ActionCard
            to="/insights"
            icon={<LayoutDashboard size={28} className="opacity-90" />}
            title="Dashboard"
            description="See KPIs and trends at a glance"
          />
        </div>
      </section>
    </div>
  )
}

function FeatureCard({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="tile tile-lift text-center">
      <div className="mx-auto mb-2 inline-flex items-center justify-center h-12 w-12 rounded-full bg-black/5 dark:bg-white/10">
        {icon}
      </div>
      <h3 className="tile-title">{title}</h3>
      <p className="tile-sub">{description}</p>
    </div>
  )
}

function ActionCard({
  to, icon, title, description,
}: { to: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="tile tile-lift flex items-start gap-3 no-underline">
      <div className="p-2 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h4 className="tile-title">{title}</h4>
        <p className="tile-sub">{description}</p>
      </div>
    </Link>
  )
}
