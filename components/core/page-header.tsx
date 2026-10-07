import type React from "react"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Contêiner padrão de página: largura máxima e ritmo vertical consistentes. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1520px] space-y-6", className)} {...props} />
}
