import { useId } from "react"
import { cn } from "@/lib/utils"

/**
 * Símbolo CORE: "C" encorpado com dobras sobrepostas em amarelo/laranja.
 * Vetor recriado a partir do logo oficial — para usar o arquivo original,
 * salve-o em public/brand/core-mark.png e troque este SVG por <img src="/brand/core-mark.png" />.
 */
export function CoreMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "")
  const id = (name: string) => `${name}-${uid}`
  // Arco do "C": abertura à direita, pontas arredondadas.
  const arc = "M36.2 13.6 A15.5 15.5 0 1 0 36.2 34.4"
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-9 shrink-0", className)}>
      <defs>
        <linearGradient id={id("base")} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#FFD21A" />
          <stop offset="55%" stopColor="#FFC400" />
          <stop offset="100%" stopColor="#FFB300" />
        </linearGradient>
        <radialGradient id={id("fold1")} cx="0.75" cy="0.2" r="0.9">
          <stop offset="0%" stopColor="#FF9800" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FFC400" stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={id("fold2")} cx="0.2" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#FF9A00" />
          <stop offset="70%" stopColor="#FFB000" />
          <stop offset="100%" stopColor="#FFC400" />
        </radialGradient>
        <linearGradient id={id("fold3")} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#FFA000" />
          <stop offset="100%" stopColor="#FFEA3D" />
        </linearGradient>
        <mask id={id("shape")}>
          <path d={arc} fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
        </mask>
      </defs>
      <g mask={`url(#${id("shape")})`}>
        <rect width="48" height="48" fill={`url(#${id("base")})`} />
        {/* dobra superior interna */}
        <ellipse cx="22" cy="20" rx="16" ry="12" fill={`url(#${id("fold1")})`} opacity="0.55" />
        {/* lóbulo lateral esquerdo */}
        <circle cx="14.5" cy="31" r="11" fill={`url(#${id("fold2")})`} opacity="0.9" />
        {/* dobra inferior que segue até a ponta */}
        <path d="M18 44 C20 34 28 33 34 35.5 C38 37 41 40 41 40 L41 48 L18 48 Z" fill={`url(#${id("fold3")})`} />
        {/* brilho na borda superior */}
        <path d={arc} fill="none" stroke="#FFE36A" strokeOpacity="0.45" strokeWidth="1.2" transform="translate(-0.4 -0.6)" />
      </g>
    </svg>
  )
}

export function CoreLogo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <CoreMark />
      {!collapsed && <span className="text-[22px] font-semibold tracking-tight text-foreground">Core</span>}
    </span>
  )
}
