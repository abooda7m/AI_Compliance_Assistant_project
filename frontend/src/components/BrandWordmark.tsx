type Props = { size?: "sm" | "md" | "lg"; centered?: boolean }

const sizes = {
  sm: "text-4xl sm:text-5xl",
  md: "text-5xl sm:text-6xl",
  lg: "text-6xl sm:text-7xl",
}

export default function BrandWordmark({ size = "lg", centered = false }: Props) {
  return (
    <h1
      className={[
        centered && "text-center",
        "font-black leading-none tracking-tight pt-5 select-none",
        "text-transparent bg-clip-text",
        "bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400",
        sizes[size],
        "mix-blend-normal", 
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ textShadow: "none" }}
    >
      مُحْكَم
    </h1>
  )
}
