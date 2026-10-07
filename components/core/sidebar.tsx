"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CoreLogo } from "@/components/core/logo"
import { allNavItems, canAccess, navGroups, roleLabels, type NavItem } from "@/components/core/navigation"
import { useAuth } from "@/lib/auth-context"
import { cn, getInitials } from "@/lib/utils"

export const SIDEBAR_WIDTH = 240
export const SIDEBAR_COLLAPSED_WIDTH = 72
const GROUPS_KEY = "core-nav-closed-groups"

/** Item ativo = rota igual (ou subrota) e todos os parâmetros do link presentes na URL; vence o mais específico. */
function useActiveHref() {
  const pathname = usePathname()
  const params = useSearchParams()
  return useMemo(() => {
    let best: { href: string; score: number } | null = null
    for (const item of allNavItems) {
      const [path, query] = item.href.split("?")
      if (!(pathname === path || pathname.startsWith(`${path}/`))) continue
      const wanted = new URLSearchParams(query ?? "")
      let ok = true
      let score = 0
      wanted.forEach((v, k) => { if (params.get(k) === v) score++; else ok = false })
      if (ok && (!best || score > best.score)) best = { href: item.href, score }
    }
    return best?.href ?? null
  }, [pathname, params])
}

function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  const soon = item.phase !== undefined
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring",
        collapsed ? "h-10 justify-center px-0" : "h-9 px-3",
        active
          ? "border-[var(--core-yellow-border)] bg-[var(--core-yellow-tint)] text-white shadow-[0_0_24px_rgba(255,190,0,0.08)]"
          : soon
            ? "border-transparent text-subtle hover:bg-white/[0.04] hover:text-muted-foreground"
            : "border-transparent text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
      )}
    >
      {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" aria-hidden="true" />}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : soon ? "text-subtle/70" : "text-subtle group-hover:text-foreground")} strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && soon && (
        <span className="ml-auto rounded-md border border-white/[0.08] px-1.5 py-px text-[10px] font-medium tabular-nums text-subtle" title={item.phase ? `Em construção — Fase ${item.phase}` : "Em construção"}>
          {item.phase ? `F${item.phase}` : "Breve"}
        </span>
      )}
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarInner({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const activeHref = useActiveHref()
  const [closed, setClosed] = useState<Set<string>>(new Set())

  useEffect(() => {
    try { setClosed(new Set(JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]"))) } catch {}
  }, [])

  function toggleGroup(label: string) {
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(user, i.permission)) }))
    .filter((g) => g.items.length)

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center" : "px-4")}>
          <Link href="/dashboard" onClick={onNavigate} aria-label="Core — ir para o dashboard" className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
            <CoreLogo collapsed={collapsed} />
          </Link>
        </div>

        <nav aria-label="Navegação principal" className="mt-1 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {groups.map((group) => {
            const hasActive = group.items.some((i) => i.href === activeHref)
            const isOpen = collapsed || hasActive || !closed.has(group.label)
            return (
              <div key={group.label}>
                {collapsed ? (
                  <div className="mx-auto mb-2 h-px w-6 bg-white/[0.08]" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={isOpen}
                    className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle/80 transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {group.label}
                    <ChevronDown className={cn("size-3.5 transition-transform duration-150", !isOpen && "-rotate-90")} />
                  </button>
                )}
                {isOpen && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} active={item.href === activeHref} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              className={cn("flex h-9 w-full items-center gap-3 rounded-xl text-xs text-subtle transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", collapsed ? "justify-center" : "px-3")}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Recolher menu</>}
            </button>
          )}
          <div className={cn("flex items-center gap-3 rounded-xl", collapsed ? "flex-col" : "bg-white/[0.03] p-2")}>
            <Avatar className="size-9 shrink-0 border border-white/10">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{user ? getInitials(user.name) : "US"}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
                <p className="truncate text-xs text-subtle">{roleLabels[user?.role ?? "user"] ?? user?.role}</p>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={logout} aria-label="Sair" className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-ring">
                  <LogOut className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

/** Sidebar desktop/tablet: painel de vidro flutuante, recolhível para 72px. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden p-3 transition-[width] duration-200 ease-out md:block"
      style={{ width: (collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) + 12 }}
    >
      <div className="glass h-full overflow-hidden rounded-[22px] bg-[rgba(12,12,13,0.7)]">
        <SidebarInner collapsed={collapsed} onToggle={onToggle} />
      </div>
    </aside>
  )
}

/** Mobile: menu em drawer. */
export function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[284px] gap-0 p-0 sm:max-w-[284px]">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Navegação principal do sistema</SheetDescription>
        <SidebarInner collapsed={false} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
