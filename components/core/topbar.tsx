"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronDown, CircleHelp, KeyRound, LogOut, Menu, Plus, Search, Settings } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChangePasswordModal } from "@/components/core/change-password"
import { NotificationsButton } from "@/components/core/notifications"
import { canAccess, liveNavItems, quickActions, roleLabels } from "@/components/core/navigation"
import { useAuth } from "@/lib/auth-context"
import { getInitials } from "@/lib/utils"

function useIsMac() {
  const [mac, setMac] = useState(false)
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), [])
  return mac
}

export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const isMac = useIsMac()
  const current = liveNavItems.find((i) => !i.href.includes("?") && (pathname === i.href || pathname.startsWith(`${i.href}/`)))
  const pageLabel = current?.label ?? "Início"
  const actions = quickActions.filter((a) => canAccess(user, a.permission))

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 md:px-6">
      <div className="glass flex h-14 items-center gap-2 rounded-2xl bg-[rgba(12,12,13,0.72)] px-2 sm:gap-3 sm:px-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu />
        </Button>

        <nav aria-label="Você está em" className="hidden min-w-0 items-center gap-2 text-sm lg:flex lg:w-56">
          <span className="text-subtle">Core</span>
          <span className="text-subtle/60">/</span>
          <span className="truncate font-medium text-foreground">{pageLabel}</span>
        </nav>

        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-white/[0.035] px-3.5 text-left text-sm text-subtle transition-colors hover:border-border-strong hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-ring lg:mx-auto lg:max-w-xl"
          aria-label="Abrir busca global"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Buscar clientes, chamados, páginas...</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1 lg:w-56 lg:justify-end">
          {actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9 px-3" aria-label="Criar novo">
                  <Plus /> <span className="hidden sm:inline">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {actions.map((a) => (
                  <DropdownMenuItem key={a.href} onSelect={() => router.push(a.href)}>
                    <a.icon className="text-primary" /> {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <NotificationsButton />

          <Popover>
            <PopoverTrigger aria-label="Ajuda" className="hidden size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:grid">
              <CircleHelp className="size-[18px]" strokeWidth={1.75} />
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-72">
              <p className="text-sm font-semibold">Atalhos</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Busca global</dt><dd className="flex gap-1"><Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd><Kbd>K</Kbd></dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Recolher menu</dt><dd className="flex gap-1"><Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd><Kbd>B</Kbd></dd></div>
                <div className="flex items-center justify-between"><dt className="text-muted-foreground">Fechar janela</dt><dd><Kbd>Esc</Kbd></dd></div>
              </dl>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-ring xl:pr-2" aria-label="Menu da conta">
              <Avatar className="size-8 border border-white/10">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{user ? getInitials(user.name) : "US"}</AvatarFallback>
              </Avatar>
              <ChevronDown className="hidden size-3.5 text-subtle xl:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-foreground">{user?.name || "Usuário"}</p>
                <p className="truncate text-xs text-subtle">{user?.email}</p>
                <p className="mt-1.5 inline-flex rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{roleLabels[user?.role ?? "user"] ?? user?.role}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canAccess(user, "configuracoes") && (
                <DropdownMenuItem asChild>
                  <Link href="/configuracoes"><Settings /> Configurações</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
                <KeyRound /> Alterar senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={logout}>
                <LogOut /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ChangePasswordModal open={passwordOpen} onOpenChange={setPasswordOpen} />
      {/* Senha provisória (criada/redefinida por um administrador): troca obrigatória ao entrar */}
      <ChangePasswordModal open={Boolean(user?.mustChangePassword)} onOpenChange={() => {}} forced />
    </header>
  )
}
