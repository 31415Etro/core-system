"use client"

import type React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const modalSize = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const

type OverlayProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/** Modal padrão CORE — criação rápida, edição pequena, confirmação. */
export function Modal({ size = "md", open, onOpenChange, title, description, footer, children, className, dismissible = true }: OverlayProps & { size?: keyof typeof modalSize; /** false = sem botão de fechar, Esc nem clique fora */ dismissible?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={dismissible}
        onEscapeKeyDown={dismissible ? undefined : (e) => e.preventDefault()}
        onPointerDownOutside={dismissible ? undefined : (e) => e.preventDefault()}
        className={cn("max-h-[92dvh] overflow-y-auto", modalSize[size], className)}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter className="border-t border-border pt-4">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

/** Drawer lateral — visualização detalhada sem sair da página. */
export function Drawer({ open, onOpenChange, title, description, footer, children, className, width = "md" }: OverlayProps & { width?: "md" | "lg" }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("w-full gap-0 p-0", width === "md" ? "sm:max-w-md" : "sm:max-w-xl", className)}>
        <SheetHeader className="border-b border-border p-5 pr-14">
          <SheetTitle className="text-lg tracking-tight">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </SheetContent>
    </Sheet>
  )
}

/** Par rótulo/valor para painéis de detalhe. */
export function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}
