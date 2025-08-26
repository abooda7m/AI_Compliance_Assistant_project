// frontend-fastapi/src/components/PageHeader.tsx
export default function PageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-4 md:mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </p>
      )}
    </div>
  )
}
