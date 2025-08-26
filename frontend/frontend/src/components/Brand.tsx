// src/components/Brand.tsx

import { Link } from "react-router-dom"

/* ===========================
   1) YOUR BRAND (default export)
   MUHKAM (لاتيني) + مُحْكَم (عربي) بترتيب ثابت LTR
   =========================== */
type Props = { size?: "sm" | "md" | "lg"; center?: boolean }

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-[28px] md:text-[32px]",
  md: "text-[44px] md:text-[52px]",
  lg: "text-[56px] md:text-[64px]",
}

export default function Brand({ size = "sm", center = false }: Props) {
  return (
    <div
      style={{ direction: "ltr" }}
      className={[
        "inline-flex items-baseline gap-2 md:gap-3",
        "leading-none font-extrabold select-none tracking-tight whitespace-nowrap",
        SIZE[size],
        center ? "justify-center w-full" : "",
      ].join(" ")}
    >
      {/* لاتيني دائمًا على اليسار */}
      <span dir="ltr" className="order-1 font-latin text-brand-indigo">
        MUHKAM
      </span>

      {/* عربي دائمًا على اليمين */}
      <span dir="rtl" className="order-2 font-ar text-black dark:text-white">
        مُحْكَم
      </span>
    </div>
  )
}

/* ===========================
   2) TEAMMATE'S BRAND (named exports)
   LogoMark / LogoWordmark / BrandLink
   تبقى كما هي لاستخدامها في التابات الأخرى
   =========================== */

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="muhkam-mark"
      style={{ inlineSize: size, blockSize: size }}
      aria-hidden="true"
    >
      <span className="muhkam-mark__glyph">م</span>
    </span>
  )
}

export function LogoWordmark({
  size = "lg",
  withMark = true,
}: {
  size?: "sm" | "lg"
  withMark?: boolean
}) {
  return (
    <div className="muhkam-brand inline-flex items-center gap-2">
      {withMark && <LogoMark />}
      <span className={`muhkam-word ${size}`}>مُحْكَم</span>
    </div>
  )
}

export function BrandLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 no-underline">
      <LogoMark />
      <span className="muhkam-word lg">مُحْكَم</span>
    </Link>
  )
}
