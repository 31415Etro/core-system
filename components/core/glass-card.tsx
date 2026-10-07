import type React from "react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type GlassCardProps = React.ComponentProps<"section"> & {
  highlight?: boolean
  interactive?: boolean
  padded?: boolean
}

/** Placa de vidro escuro — base de todos os cards do sistema. */
export function GlassCard({ className, highlight, interactive, padded = true, ...props }: GlassCardProps) {
  return (
    <section
      className={cn(
        "glass relative rounded-[20px]",
        padded && "p-5",
        highlight && "glass-highlight",
        interactive && "interactive-lift",
        className,
      )}
      {...props}
    />
  )
}

/** Ícone em "pastilha" dourada usado nos headers de card e KPIs. */
export function IconTile({ icon: Icon, tone = "primary", className }: { icon: LucideIcon; tone?: "primary" | "neutral"; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl border",
        tone === "primary" ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-white/[0.04] text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </span>
  )
}

export function CardHeader({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <IconTile icon={icon} className="size-9" />}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function CardLink({ href, children = "Ver todos" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary transition-colors hover:text-[var(--core-yellow-soft)] focus-visible:outline-2 focus-visible:outline-ring">
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  )
}
