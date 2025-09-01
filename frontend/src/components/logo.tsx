// src/components/Logo.tsx
import lightSvg from '../assets/brand/muhkam-light.svg'
import darkSvg  from '../assets/brand/muhkam-dark.svg'

type Props = {
  className?: string
  alt?: string
  lightOverride?: string
  darkOverride?: string
}

export default function Logo({
  className = 'h-12',   
  alt = 'MUHKAM',
  lightOverride,
  darkOverride,
}: Props) {
  const light = lightOverride ?? lightSvg
  const dark  = darkOverride  ?? darkSvg

  
  const imgCls =
    'select-none pointer-events-none block h-full w-auto max-w-full object-contain leading-none align-middle'

  return (
    <span className={`inline-flex items-center ${className}`} aria-label={alt}>
      <img
        src={light}
        alt={alt}
        className={`${imgCls} dark:hidden`}
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      <img
        src={dark || light}
        alt={alt}
        className={`${imgCls} hidden dark:block`}
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
    </span>
  )
}
